import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isValidTxHash(str: string): boolean {
  // eCash tx hash is 64 hex characters
  const txRegex = /^[0-9a-f]{64}$/i;
  return txRegex.test(str);
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

    const body = await req.json();
    const { user_id, prediction_id, position, amount, tx_hash } = body;

    // Validate inputs
    if (!user_id || !isValidUUID(user_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prediction_id || !isValidUUID(prediction_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid prediction_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (position !== 'yes' && position !== 'no') {
      return new Response(
        JSON.stringify({ error: 'Position must be "yes" or "no"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof amount !== 'number' || amount < 100 || amount > 1000000000) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount (min 1 XEC, max 10M XEC)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify prediction exists and is active
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

    if (new Date(prediction.end_date) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Prediction has ended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create bet
    const betData: {
      user_id: string;
      prediction_id: string;
      position: string;
      amount: number;
      status: string;
      tx_hash?: string;
      confirmed_at?: string;
    } = {
      user_id,
      prediction_id,
      position,
      amount,
      status: tx_hash ? 'confirmed' : 'pending',
    };

    if (tx_hash) {
      if (!isValidTxHash(tx_hash)) {
        return new Response(
          JSON.stringify({ error: 'Invalid transaction hash format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      betData.tx_hash = tx_hash;
      betData.confirmed_at = new Date().toISOString();
    }

    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert(betData)
      .select()
      .single();

    if (betError) {
      console.error('Error creating bet:', betError);
      
      // Check for duplicate tx_hash
      if (betError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Transaction already recorded' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create bet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If confirmed, calculate and record platform fee (1%)
    if (tx_hash && bet) {
      const feeAmount = Math.floor(amount * 0.01);
      await supabase
        .from('platform_fees')
        .insert({
          bet_id: bet.id,
          amount: feeAmount,
        });
    }

    console.log(`Bet created: ${bet.id} for user ${user_id}, prediction ${prediction_id}, ${position} @ ${amount} satoshis`);

    return new Response(
      JSON.stringify({ success: true, bet }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-bet function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
