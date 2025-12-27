import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch recent bets with user and prediction info
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        amount,
        position,
        status,
        tx_hash,
        created_at,
        confirmed_at,
        user_id,
        prediction_id,
        users(ecash_address),
        predictions(title)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (betsError) {
      console.error('Error fetching bets:', betsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched ${bets?.length || 0} public bets`);

    return new Response(
      JSON.stringify({ success: true, bets: bets || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-public-bets function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
