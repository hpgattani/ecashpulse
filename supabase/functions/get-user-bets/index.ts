import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { session_token } = body;

    // Validate session and get authenticated user_id
    const sessionResult = await validateSession(supabase, session_token);
    if (!sessionResult.valid) {
      return new Response(
        JSON.stringify({ error: sessionResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_id = sessionResult.userId;

    // Fetch user's bets with prediction details
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        *,
        prediction:predictions(title, status, end_date, yes_pool, no_pool)
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (betsError) {
      console.error('Error fetching bets:', betsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${bets?.length || 0} bets for user ${user_id}`);

    return new Response(
      JSON.stringify({ success: true, bets: bets || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-user-bets function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
