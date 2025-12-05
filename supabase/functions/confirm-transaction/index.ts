import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a';
const CHRONIK_URL = 'https://chronik.be.cash/xec';

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

async function verifyTransaction(txHash: string, expectedAmount: number): Promise<{ 
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
    
    let foundAmount = 0;
    for (const output of tx.outputs) {
      const outputValue = parseInt(output.value);
      if (outputValue >= expectedAmount * 0.99) {
        foundAmount = outputValue;
        break;
      }
    }
    
    if (foundAmount < expectedAmount * 0.99) {
      return { 
        verified: false, 
        actualAmount: foundAmount,
        error: `Amount mismatch: expected ${expectedAmount}, got ${foundAmount}` 
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

    // Verify transaction
    const verification = await verifyTransaction(tx_hash, bet.amount);
    
    if (!verification.verified) {
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

    console.log(`Bet ${bet_id} confirmed with tx ${tx_hash}`);

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
