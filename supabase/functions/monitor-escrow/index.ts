import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The official escrow address
const ESCROW_ADDRESS = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a';

interface ChronikUtxo {
  txid: string;
  outIdx: number;
  value: string;
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
    // Convert address to script hash for Chronik API
    // For q-type addresses, remove prefix and use as-is
    const addressHash = ESCROW_ADDRESS.replace('ecash:', '');
    
    // Fetch transaction history for the address
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

      // Find transaction amount to escrow
      let txAmount = 0;
      for (const output of tx.outputs) {
        txAmount = Math.max(txAmount, parseInt(output.value));
      }

      // Find a matching pending bet (within 1% tolerance)
      for (const bet of pendingBets) {
        const expectedAmount = bet.amount;
        
        // Check if amount matches (within 1% for fees)
        if (txAmount >= expectedAmount * 0.99 && txAmount <= expectedAmount * 1.01) {
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
              amount: txAmount
            });
            usedTxHashes.add(tx.txid);
            console.log(`Auto-confirmed bet ${bet.id} with tx ${tx.txid}`);
            
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
