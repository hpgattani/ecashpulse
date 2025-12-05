import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
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
    const { user_id } = body;

    if (!user_id || !isValidUUID(user_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user_id' }),
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
