import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qqp5lj9c8v2s8vrjhcwu3v8t75nxz8l2h5r795qyc2';
const PLATFORM_FEE_PERCENT = 0.01;

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function validateSession(supabase: any, sessionToken: string | null | undefined) {
  if (!sessionToken || typeof sessionToken !== 'string') {
    return { valid: false, error: 'Session token is required' };
  }

  const trimmedToken = sessionToken.trim();
  if (trimmedToken.length !== 64) {
    return { valid: false, error: 'Invalid session token format' };
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', trimmedToken)
    .maybeSingle();

  if (error || !session) {
    return { valid: false, error: 'Invalid or expired session' };
  }

  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('sessions').delete().eq('token', trimmedToken);
    return { valid: false, error: 'Session expired' };
  }

  await supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', trimmedToken);

  return { valid: true, userId: session.user_id };
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
    console.log('Received body:', JSON.stringify({ ...body, session_token: '[REDACTED]' }));
    const { session_token, prediction_id, position, amount, tx_hash, outcome_id } = body;

    // Validate session and get authenticated user_id
    const sessionResult = await validateSession(supabase, session_token);
    if (!sessionResult.valid) {
      return new Response(
        JSON.stringify({ error: sessionResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_id = sessionResult.userId;
    console.log(`Processing bet: user=${user_id}, prediction=${prediction_id}, position=${position}, amount=${amount}`);

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

    const betAmount = typeof amount === 'number' ? amount : parseInt(amount);
    if (isNaN(betAmount) || betAmount < 1 || betAmount > 1000000000) {
      return new Response(
        JSON.stringify({ error: 'Amount must be between 1 XEC and 10M XEC' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify prediction exists and is active
    console.log('Checking prediction...');
    const { data: prediction, error: predError } = await supabase
      .from('predictions')
      .select('id, status, end_date')
      .eq('id', prediction_id)
      .maybeSingle();

    console.log('Prediction query result:', prediction ? 'found' : 'not found', predError ? predError.message : 'no error');

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
      console.log('Prediction has ended:', prediction.end_date);
      return new Response(
        JSON.stringify({ error: 'Prediction has ended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate outcome_id if provided (for multi-option bets)
    if (outcome_id && !isValidUUID(outcome_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid outcome_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If outcome_id provided, verify it belongs to this prediction and update outcome pool
    if (outcome_id) {
      const { data: outcome, error: outcomeError } = await supabase
        .from('outcomes')
        .select('id, prediction_id, pool')
        .eq('id', outcome_id)
        .maybeSingle();

      if (outcomeError || !outcome || outcome.prediction_id !== prediction_id) {
        return new Response(
          JSON.stringify({ error: 'Invalid outcome for this prediction' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create bet with confirmed status (payment already verified by PayButton)
    console.log('Creating bet in database...');
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        user_id,
        prediction_id,
        position,
        amount: betAmount,
        status: 'confirmed',
        tx_hash: tx_hash || null,
        confirmed_at: new Date().toISOString(),
        outcome_id: outcome_id || null
      })
      .select()
      .single();

    if (betError) {
      console.error('Error creating bet:', JSON.stringify(betError));
      return new Response(
        JSON.stringify({ error: 'Failed to create bet: ' + betError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Bet created successfully:', bet.id);

    // Record platform fee (1%)
    const feeAmount = Math.floor(betAmount * PLATFORM_FEE_PERCENT);
    await supabase.from('platform_fees').insert({
      bet_id: bet.id,
      amount: feeAmount,
    });

    // Update pools when bet is confirmed
    if (tx_hash) {
      if (outcome_id) {
        // Update outcome pool for multi-option bets
        const { data: currentOutcome } = await supabase
          .from('outcomes')
          .select('pool')
          .eq('id', outcome_id)
          .single();

        if (currentOutcome) {
          // For Yes bets, add to pool. For No bets, we could track separately or just add
          const poolChange = position === 'yes' ? betAmount : betAmount;
          const { error: updateError } = await supabase
            .from('outcomes')
            .update({ pool: (currentOutcome.pool || 0) + poolChange })
            .eq('id', outcome_id);

          if (updateError) {
            console.error('Error updating outcome pool:', updateError);
          } else {
            console.log(`Updated pool for outcome ${outcome_id}`);
          }
        }
      } else {
        // Update prediction pool for yes/no bets
        const { data: currentPrediction } = await supabase
          .from('predictions')
          .select('yes_pool, no_pool')
          .eq('id', prediction_id)
          .single();

        if (currentPrediction) {
          const updateData = position === 'yes' 
            ? { yes_pool: (currentPrediction.yes_pool || 0) + betAmount, updated_at: new Date().toISOString() }
            : { no_pool: (currentPrediction.no_pool || 0) + betAmount, updated_at: new Date().toISOString() };
          
          const { error: updateError } = await supabase
            .from('predictions')
            .update(updateData)
            .eq('id', prediction_id);

          if (updateError) {
            console.error('Error updating prediction pool:', updateError);
          } else {
            console.log(`Updated ${position}_pool for prediction ${prediction_id}`);
          }
        }
      }
    }

    console.log(`Bet created: ${bet.id} for user ${user_id}, ${position} @ ${betAmount} XEC`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        bet_id: bet.id,
        amount: betAmount,
        position,
        escrow_address: ESCROW_ADDRESS,
        platform_fee: feeAmount,
        message: `Send ${betAmount} XEC to ${ESCROW_ADDRESS} to confirm your bet`
      }),
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
