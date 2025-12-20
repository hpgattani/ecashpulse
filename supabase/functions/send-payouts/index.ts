import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHRONIK_URL = 'https://chronik.be.cash/xec';
const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

// ==================== eCash Transaction Building ====================

interface UTXO {
  outpoint: { txid: string; outIdx: number };
  blockHeight: number;
  isCoinbase: boolean;
  value: string;
  isFinal: boolean;
  token?: any;
}

interface PayoutRecipient {
  address: string;
  amount: number;
  betId: string;
  userId: string;
}

// Convert eCash cashaddr to P2PKH outputScript hex
function addressToOutputScript(address: string): string | null {
  try {
    const addr = address.replace('ecash:', '');
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

    let data: number[] = [];
    for (let i = 0; i < addr.length; i++) {
      const charIndex = CHARSET.indexOf(addr[i].toLowerCase());
      if (charIndex === -1) return null;
      data.push(charIndex);
    }

    const payloadEnd = data.length - 8;
    const payload5bit = data.slice(0, payloadEnd);

    let acc = 0;
    let bits = 0;
    const payload8bit: number[] = [];

    for (const value of payload5bit) {
      acc = (acc << 5) | value;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        payload8bit.push((acc >> bits) & 0xff);
      }
    }

    if (payload8bit.length < 21) return null;

    const hash = payload8bit.slice(1, 21);
    const hashHex = hash.map(b => b.toString(16).padStart(2, '0')).join('');

    // P2PKH: OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG
    return `76a914${hashHex}88ac`;
  } catch (error) {
    console.error('Address conversion error:', error);
    return null;
  }
}

// Get address hash from eCash address for Chronik API
function getAddressHash(address: string): string | null {
  try {
    const addr = address.replace('ecash:', '');
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

    let data: number[] = [];
    for (let i = 0; i < addr.length; i++) {
      const charIndex = CHARSET.indexOf(addr[i].toLowerCase());
      if (charIndex === -1) return null;
      data.push(charIndex);
    }

    const payloadEnd = data.length - 8;
    const payload5bit = data.slice(0, payloadEnd);

    let acc = 0;
    let bits = 0;
    const payload8bit: number[] = [];

    for (const value of payload5bit) {
      acc = (acc << 5) | value;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        payload8bit.push((acc >> bits) & 0xff);
      }
    }

    if (payload8bit.length < 21) return null;

    const hash = payload8bit.slice(1, 21);
    return hash.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Address hash error:', error);
    return null;
  }
}

// Get UTXOs for an address
async function getUTXOs(address: string): Promise<UTXO[]> {
  try {
    const addressHash = getAddressHash(address);
    if (!addressHash) {
      console.error('Failed to get address hash');
      return [];
    }
    
    const response = await fetch(`${CHRONIK_URL}/script/p2pkh/${addressHash}/utxos`);

    if (!response.ok) {
      console.error('Failed to fetch UTXOs:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return data.utxos || [];
  } catch (error) {
    console.error('Error fetching UTXOs:', error);
    return [];
  }
}

// Broadcast transaction
async function broadcastTransaction(txHex: string): Promise<string | null> {
  try {
    const response = await fetch(`${CHRONIK_URL}/broadcast-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawTx: txHex }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Broadcast failed:', error);
      return null;
    }

    const data = await response.json();
    return data.txid;
  } catch (error) {
    console.error('Broadcast error:', error);
    return null;
  }
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { prediction_id } = await req.json();

    console.log(`Processing payouts for prediction: ${prediction_id || 'all pending'}`);

    // Get all won bets that haven't been paid out yet
    let query = supabase
      .from('bets')
      .select(`
        id,
        user_id,
        amount,
        payout_amount,
        users!inner(ecash_address)
      `)
      .eq('status', 'won')
      .is('payout_tx_hash', null)
      .not('payout_amount', 'is', null);

    if (prediction_id) {
      query = query.eq('prediction_id', prediction_id);
    }

    const { data: wonBets, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!wonBets || wonBets.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending payouts',
          paid: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${wonBets.length} bets to pay out`);

    // Group payouts by user (to batch multiple winnings)
    const userPayouts = new Map<string, PayoutRecipient>();

    for (const bet of wonBets) {
      const address = (bet.users as any).ecash_address;
      const existing = userPayouts.get(address);

      if (existing) {
        existing.amount += bet.payout_amount;
      } else {
        userPayouts.set(address, {
          address,
          amount: bet.payout_amount,
          betId: bet.id,
          userId: bet.user_id,
        });
      }
    }

    const recipients = Array.from(userPayouts.values());
    console.log(`Batched into ${recipients.length} recipients`);

    // Get escrow wallet credentials from environment
    const escrowPrivateKey = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');

    if (!escrowPrivateKey) {
      throw new Error('ESCROW_PRIVATE_KEY_WIF environment variable not set');
    }

    // Check UTXOs available in escrow
    const utxos = await getUTXOs(ESCROW_ADDRESS);
    console.log(`Found ${utxos.length} UTXOs in escrow`);

    if (utxos.length === 0) {
      throw new Error('No UTXOs available in escrow wallet');
    }

    // Calculate total available
    let totalAvailable = 0;
    for (const utxo of utxos) {
      if (!utxo.token) {
        totalAvailable += parseInt(utxo.value);
      }
    }

    const totalPayout = recipients.reduce((sum, r) => sum + r.amount, 0);
    console.log(`Total to pay: ${totalPayout} sats, Available: ${totalAvailable} sats`);

    if (totalAvailable < totalPayout) {
      throw new Error(`Insufficient funds: need ${totalPayout}, have ${totalAvailable}`);
    }

    // For now, log the payout details - full transaction building requires ecash-lib integration
    console.log('Payout recipients:', JSON.stringify(recipients, null, 2));
    
    // TODO: Implement full transaction building with ecash-lib
    // This requires proper ECDSA signing which needs the full ecash library
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Payout calculation complete - automatic sending requires ecash-lib integration',
        recipients: recipients.length,
        total_amount: totalPayout,
        available_balance: totalAvailable,
        bets_pending: wonBets.length,
        details: recipients.map(r => ({
          address: r.address,
          amount: r.amount,
          userId: r.userId
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send payouts error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to send payouts',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
