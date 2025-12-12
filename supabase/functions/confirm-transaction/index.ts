import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qqp5lj9c8v2s8vrjhcwu3v8t75nxz8l2h5r795qyc2';
const CHRONIK_URL = 'https://chronik.be.cash/xec';

// Convert eCash cashaddr to P2PKH outputScript hex
// For q-type (P2PKH) addresses: 76a914<20-byte-hash>88ac
function addressToOutputScript(address: string): string | null {
  try {
    // Remove ecash: prefix
    const addr = address.replace('ecash:', '');
    
    // Cashaddr uses a specific character set
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    
    // Decode cashaddr to get the hash
    let data: number[] = [];
    for (let i = 0; i < addr.length; i++) {
      const charIndex = CHARSET.indexOf(addr[i].toLowerCase());
      if (charIndex === -1) return null;
      data.push(charIndex);
    }
    
    // Skip the type byte (first 5-bit value after removing checksum)
    // The checksum is 8 characters (40 bits)
    const payloadEnd = data.length - 8;
    const payload5bit = data.slice(0, payloadEnd);
    
    // Convert 5-bit groups to 8-bit bytes
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
    
    // First byte is version/type, rest is the 20-byte hash
    if (payload8bit.length < 21) return null;
    
    const hash = payload8bit.slice(1, 21);
    const hashHex = hash.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // P2PKH script: OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
    return `76a914${hashHex}88ac`;
  } catch (error) {
    console.error('Address conversion error:', error);
    return null;
  }
}

interface ChronikTx {
  txid: string;
  outputs: Array<{
    value: string;
    outputScript: string;
  }>;
  block?: {
    height: number;
  };
}

async function verifyTransaction(txHash: string, expectedAmount: number, escrowScript: string): Promise<{ 
  verified: boolean; 
  actualAmount?: number;
  error?: string 
}> {
  try {
    const response = await fetch(`${CHRONIK_URL}/tx/${txHash}`);
    
    if (!response.ok) {
      return { verified: false, error: 'Transaction not found on blockchain' };
    }
    
    const tx: ChronikTx = await response.json();
    
    // Find output that goes to escrow address with correct amount
    let foundAmount = 0;
    let foundEscrowOutput = false;
    
    for (const output of tx.outputs) {
      const outputValue = parseInt(output.value);
      
      // CRITICAL: Verify output goes to escrow address
      if (output.outputScript === escrowScript) {
        foundEscrowOutput = true;
        if (outputValue >= expectedAmount * 0.99) {
          foundAmount = outputValue;
          break;
        }
      }
    }
    
    if (!foundEscrowOutput) {
      return { 
        verified: false, 
        error: 'Transaction does not send funds to escrow address' 
      };
    }
    
    if (foundAmount < expectedAmount * 0.99) {
      return { 
        verified: false, 
        actualAmount: foundAmount,
        error: `Amount to escrow insufficient: expected ${expectedAmount}, got ${foundAmount}` 
      };
    }
    
    return { verified: true, actualAmount: foundAmount };
  } catch (error) {
    console.error('Transaction verification error:', error);
    return { verified: false, error: 'Failed to verify transaction' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bet_id, tx_hash } = await req.json();

    // Validate bet_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!bet_id || !uuidRegex.test(bet_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid bet_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tx_hash
    if (!tx_hash || typeof tx_hash !== 'string' || !/^[0-9a-f]{64}$/i.test(tx_hash)) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction hash' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert escrow address to outputScript for verification
    const escrowScript = addressToOutputScript(ESCROW_ADDRESS);
    if (!escrowScript) {
      console.error('Failed to convert escrow address to script');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get bet details
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .select('id, amount, status, user_id, prediction_id')
      .eq('id', bet_id)
      .single();

    if (betError || !bet) {
      return new Response(
        JSON.stringify({ error: 'Bet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (bet.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Bet is not pending confirmation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if tx_hash is already used
    const { data: existingBet } = await supabase
      .from('bets')
      .select('id')
      .eq('tx_hash', tx_hash)
      .neq('id', bet_id)
      .maybeSingle();

    if (existingBet) {
      return new Response(
        JSON.stringify({ error: 'Transaction already used for another bet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction with destination check
    const verification = await verifyTransaction(tx_hash, bet.amount, escrowScript);
    
    if (!verification.verified) {
      console.log(`Transaction verification failed for bet ${bet_id}: ${verification.error}`);
      return new Response(
        JSON.stringify({ error: verification.error || 'Transaction verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update bet status
    const { error: updateError } = await supabase
      .from('bets')
      .update({
        status: 'confirmed',
        tx_hash: tx_hash,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', bet_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to confirm bet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Bet ${bet_id} confirmed with tx ${tx_hash} - verified escrow destination`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bet confirmed successfully',
        bet_id,
        tx_hash,
        amount: verification.actualAmount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Confirm transaction error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
