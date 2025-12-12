import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The official escrow address
const ESCROW_ADDRESS = 'ecash:qqp5lj9c8v2s8vrjhcwu3v8t75nxz8l2h5r795qyc2';

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
  inputs: Array<{
    inputScript: string;
    outputScript: string;
  }>;
  timeFirstSeen: number;
  block?: {
    height: number;
    timestamp: number;
  };
}

// Get recent transactions to the escrow address
async function getRecentTransactions(): Promise<ChronikTx[]> {
  try {
    const addressHash = ESCROW_ADDRESS.replace('ecash:', '');
    
    const response = await fetch(
      `https://chronik.be.cash/xec/address/${addressHash}/history?page=0&pageSize=50`
    );
    
    if (!response.ok) {
      console.error('Failed to fetch address history:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data.txs || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
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

    // Convert escrow address to outputScript for verification
    const escrowScript = addressToOutputScript(ESCROW_ADDRESS);
    if (!escrowScript) {
      console.error('Failed to convert escrow address to script');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all pending bets
    const { data: pendingBets, error: betsError } = await supabase
      .from('bets')
      .select('id, amount, user_id, prediction_id, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (betsError) {
      console.error('Error fetching pending bets:', betsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending bets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingBets || pendingBets.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending bets to process', confirmed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recent transactions to escrow
    const transactions = await getRecentTransactions();
    console.log(`Found ${transactions.length} recent transactions to escrow`);

    // Get already used tx hashes
    const { data: usedTxs } = await supabase
      .from('bets')
      .select('tx_hash')
      .not('tx_hash', 'is', null);
    
    const usedTxHashes = new Set((usedTxs || []).map(b => b.tx_hash));

    let confirmedCount = 0;
    const confirmations: Array<{ bet_id: string; tx_hash: string; amount: number }> = [];

    // Match transactions to pending bets
    for (const tx of transactions) {
      if (usedTxHashes.has(tx.txid)) {
        continue; // Skip already used transactions
      }

      // CRITICAL: Find transaction amount that specifically goes to escrow address
      let txAmountToEscrow = 0;
      for (const output of tx.outputs) {
        // Verify this output goes to the escrow address
        if (output.outputScript === escrowScript) {
          txAmountToEscrow = parseInt(output.value);
          break; // Found the escrow output
        }
      }

      // Skip if no amount was sent to escrow
      if (txAmountToEscrow === 0) {
        console.log(`Transaction ${tx.txid} has no output to escrow address, skipping`);
        continue;
      }

      // Find a matching pending bet (within 1% tolerance)
      for (const bet of pendingBets) {
        const expectedAmount = bet.amount;
        
        // Check if amount matches (within 1% for fees)
        if (txAmountToEscrow >= expectedAmount * 0.99 && txAmountToEscrow <= expectedAmount * 1.01) {
          // Confirm this bet
          const { error: updateError } = await supabase
            .from('bets')
            .update({
              status: 'confirmed',
              tx_hash: tx.txid,
              confirmed_at: new Date().toISOString()
            })
            .eq('id', bet.id)
            .eq('status', 'pending'); // Extra check to prevent race conditions

          if (!updateError) {
            confirmedCount++;
            confirmations.push({
              bet_id: bet.id,
              tx_hash: tx.txid,
              amount: txAmountToEscrow
            });
            usedTxHashes.add(tx.txid);
            console.log(`Auto-confirmed bet ${bet.id} with tx ${tx.txid} - verified escrow destination`);
            
            // Remove from pending list
            const betIndex = pendingBets.indexOf(bet);
            if (betIndex > -1) {
              pendingBets.splice(betIndex, 1);
            }
            break; // Move to next transaction
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Processed ${transactions.length} transactions, confirmed ${confirmedCount} bets`,
        confirmed: confirmedCount,
        confirmations
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Monitor escrow error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
