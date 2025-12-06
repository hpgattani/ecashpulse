import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHRONIK_URL = 'https://chronik.e.cash';
const ESCROW_ADDRESS = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a';
const ESCROW_SCRIPT_HASH = 'r6pwzt7glvmq6ryr4305kat0vnv2wy69q';

interface ChronikTx {
  txid: string;
  timeFirstSeen: number;
  outputs: { value: string; outputScript: string }[];
}

// Fetch recent transactions from Chronik
async function fetchRecentTransactions(limit = 50): Promise<ChronikTx[]> {
  try {
    const response = await fetch(
      `${CHRONIK_URL}/script/p2pkh/${ESCROW_SCRIPT_HASH}/history?page=0&page_size=${limit}`
    );
    if (!response.ok) {
      throw new Error(`Chronik API error: ${response.status}`);
    }
    const data = await response.json();
    return data.txs || [];
  } catch (error) {
    console.error('Failed to fetch from Chronik:', error);
    return [];
  }
}

// Get transaction details
async function getTransactionDetails(txid: string): Promise<ChronikTx | null> {
  try {
    const response = await fetch(`${CHRONIK_URL}/tx/${txid}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to get tx details:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const { tx_hash, prediction_id, position, amount, session_token, user_id } = body;

    console.log('[sync-escrow] Request:', { tx_hash, prediction_id, position, amount, user_id: user_id?.slice(0, 8) });

    // Mode 1: Verify and record a specific transaction
    if (tx_hash && prediction_id && position && amount && (session_token || user_id)) {
      // Validate session if provided
      let validUserId = user_id;
      if (session_token && !user_id) {
        const { data: session } = await supabase
          .from('sessions')
          .select('user_id')
          .eq('token', session_token)
          .maybeSingle();
        
        if (!session) {
          return new Response(
            JSON.stringify({ error: 'Invalid session' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        validUserId = session.user_id;
      }

      // Check if bet already exists with this tx_hash
      const { data: existingBet } = await supabase
        .from('bets')
        .select('id')
        .eq('tx_hash', tx_hash)
        .maybeSingle();

      if (existingBet) {
        console.log('[sync-escrow] Bet already exists for tx:', tx_hash);
        return new Response(
          JSON.stringify({ success: true, bet_id: existingBet.id, already_exists: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify transaction on blockchain
      const txDetails = await getTransactionDetails(tx_hash);
      if (!txDetails) {
        console.log('[sync-escrow] Transaction not found on blockchain:', tx_hash);
        return new Response(
          JSON.stringify({ error: 'Transaction not found on blockchain. It may still be propagating.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify amount sent to escrow
      let escrowAmount = 0;
      for (const output of txDetails.outputs) {
        // Check if output script matches escrow address
        if (output.outputScript.includes('76a914') && output.outputScript.includes('f41c25f91b66c1a1903ac5f4b757d8d9a7113a28')) {
          escrowAmount += parseInt(output.value);
        }
      }
      const escrowXec = escrowAmount / 100;
      console.log('[sync-escrow] TX verified. Escrow amount:', escrowXec, 'XEC');

      // Check prediction exists and is active
      const { data: prediction, error: predError } = await supabase
        .from('predictions')
        .select('id, status, end_date')
        .eq('id', prediction_id)
        .single();

      if (predError || !prediction) {
        return new Response(
          JSON.stringify({ error: 'Prediction not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (prediction.status !== 'active') {
        return new Response(
          JSON.stringify({ error: 'Prediction is no longer active' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the bet
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: validUserId,
          prediction_id,
          position,
          amount: Math.round(amount),
          status: 'confirmed',
          tx_hash,
          confirmed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (betError) {
        console.error('[sync-escrow] Failed to create bet:', betError);
        return new Response(
          JSON.stringify({ error: 'Failed to create bet', details: betError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Record platform fee
      const feeAmount = Math.floor(amount * 0.01);
      await supabase.from('platform_fees').insert({
        bet_id: bet.id,
        amount: feeAmount,
      });

      console.log('[sync-escrow] Bet created successfully:', bet.id);
      return new Response(
        JSON.stringify({ success: true, bet_id: bet.id, amount: bet.amount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mode 2: Scan for unrecorded transactions
    console.log('[sync-escrow] Scanning for unrecorded transactions...');
    const recentTxs = await fetchRecentTransactions(50);
    console.log(`[sync-escrow] Found ${recentTxs.length} recent transactions`);

    // Get all recorded tx_hashes
    const { data: recordedBets } = await supabase
      .from('bets')
      .select('tx_hash')
      .not('tx_hash', 'is', null);

    const recordedTxHashes = new Set((recordedBets || []).map(b => b.tx_hash));

    // Find unrecorded transactions
    const unrecordedTxs = recentTxs.filter(tx => !recordedTxHashes.has(tx.txid));
    console.log(`[sync-escrow] Found ${unrecordedTxs.length} unrecorded transactions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        scanned: recentTxs.length,
        unrecorded_count: unrecordedTxs.length,
        unrecorded_txs: unrecordedTxs.slice(0, 10).map(tx => ({
          txid: tx.txid,
          timestamp: tx.timeFirstSeen
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[sync-escrow] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
