import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a';
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
    const { session_token, prediction_id, position, amount, tx_hash } = body;

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
    if (isNaN(betAmount) || betAmount < 100 || betAmount > 1000000000) {
      return new Response(
        JSON.stringify({ error: 'Amount must be between 100 XEC and 10M XEC' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Create bet with pending status
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        user_id,
        prediction_id,
        position,
        amount: betAmount,
        status: tx_hash ? 'confirmed' : 'pending',
        tx_hash: tx_hash || null,
        confirmed_at: tx_hash ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (betError) {
      console.error('Error creating bet:', betError);
      return new Response(
        JSON.stringify({ error: 'Failed to create bet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record platform fee (1%)
    const feeAmount = Math.floor(betAmount * PLATFORM_FEE_PERCENT);
    await supabase.from('platform_fees').insert({
      bet_id: bet.id,
      amount: feeAmount,
    });

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
