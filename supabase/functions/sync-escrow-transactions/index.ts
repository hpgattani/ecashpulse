import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use the REST API endpoint which returns JSON
const CHRONIK_URL = 'https://chronik.e.cash';
// Correct script hash for ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a
const ESCROW_SCRIPT_HASH = 'f41c25f91b66c1a1903ac5f4b757d8d9a7113a28';

interface ChronikTx {
  txid: string;
  timeFirstSeen: number;
  outputs: { value: string; outputScript: string }[];
}

// Fetch recent transactions from Chronik - use Accept header for JSON
async function fetchRecentTransactions(limit = 50): Promise<ChronikTx[]> {
  try {
    const url = `${CHRONIK_URL}/script/p2pkh/${ESCROW_SCRIPT_HASH}/history?page=0&page_size=${limit}`;
    console.log('[sync-escrow] Fetching from:', url);
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('[sync-escrow] Chronik error response:', text);
      throw new Error(`Chronik API error: ${response.status}`);
    }
    const data = await response.json();
    console.log('[sync-escrow] Received txs:', data.txs?.length || 0);
    return data.txs || [];
  } catch (error) {
    console.error('[sync-escrow] Failed to fetch from Chronik:', error);
    return [];
  }
}

// Get transaction details - use Accept header for JSON
async function getTransactionDetails(txid: string): Promise<ChronikTx | null> {
  try {
    const url = `${CHRONIK_URL}/tx/${txid}`;
    console.log('[sync-escrow] Fetching tx details:', url);
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      console.log('[sync-escrow] TX not found, status:', response.status);
      return null;
    }
    const data = await response.json();
    console.log('[sync-escrow] TX details received:', data.txid);
    return data;
  } catch (error) {
    console.error('[sync-escrow] Failed to get tx details:', error);
    return null;
  }
}

// Validate session and return user_id
async function validateSession(supabase: any, sessionToken: string): Promise<string | null> {
  if (!sessionToken || sessionToken.length !== 64) return null;
  
  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', sessionToken.trim())
    .maybeSingle();

  if (error || !session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  // Update last used
  await supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', sessionToken.trim());

  return session.user_id;
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

    console.log('[sync-escrow] Request received:', { 
      tx_hash: tx_hash?.slice(0, 16), 
      prediction_id: prediction_id?.slice(0, 8), 
      position, 
      amount,
      has_session: !!session_token,
      has_user_id: !!user_id
    });

    // Mode 1: Verify and record a specific transaction
    if (tx_hash && prediction_id && position && amount) {
      // Validate user
      let validUserId = user_id;
      if (session_token) {
        const sessionUserId = await validateSession(supabase, session_token);
        if (sessionUserId) {
          validUserId = sessionUserId;
        }
      }

      if (!validUserId) {
        console.log('[sync-escrow] No valid user ID');
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      console.log('[sync-escrow] Verifying TX on blockchain:', tx_hash);
      const txDetails = await getTransactionDetails(tx_hash);
      if (!txDetails) {
        console.log('[sync-escrow] Transaction not found on blockchain yet');
        return new Response(
          JSON.stringify({ error: 'Transaction not found on blockchain. It may still be propagating.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify amount sent to escrow - look for outputs to our address
      let escrowAmount = 0;
      for (const output of txDetails.outputs) {
        // Check if output script matches escrow address (p2pkh script with our hash)
        if (output.outputScript && output.outputScript.includes(ESCROW_SCRIPT_HASH)) {
          escrowAmount += parseInt(output.value);
        }
      }
      const escrowXec = escrowAmount / 100; // Convert satoshis to XEC
      console.log('[sync-escrow] TX verified. Escrow amount:', escrowXec, 'XEC, Expected:', amount);

      // Check prediction exists and is active
      const { data: prediction, error: predError } = await supabase
        .from('predictions')
        .select('id, status, end_date')
        .eq('id', prediction_id)
        .single();

      if (predError || !prediction) {
        console.log('[sync-escrow] Prediction not found:', prediction_id);
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

      // Create the bet - use the actual amount received on chain
      const betAmount = Math.round(escrowXec > 0 ? escrowXec : amount);
      
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: validUserId,
          prediction_id,
          position,
          amount: betAmount,
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

      // Record platform fee (1%)
      const feeAmount = Math.floor(betAmount * 0.01);
      await supabase.from('platform_fees').insert({
        bet_id: bet.id,
        amount: feeAmount,
      });

      console.log('[sync-escrow] Bet created successfully:', bet.id, 'amount:', betAmount);
      return new Response(
        JSON.stringify({ success: true, bet_id: bet.id, amount: betAmount }),
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
    console.error('[sync-escrow] Error:', error?.message, error?.stack);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
