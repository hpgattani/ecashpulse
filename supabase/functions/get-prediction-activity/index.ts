import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prediction_id } = await req.json();

    if (!prediction_id) {
      return new Response(
        JSON.stringify({ error: 'prediction_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Use service role to bypass RLS and fetch all confirmed bets for this prediction
    // First get total count
    const { count: totalCount, error: countError } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .eq('prediction_id', prediction_id)
      .eq('status', 'confirmed');

    if (countError) {
      console.error('Error fetching bet count:', countError);
    }

    // Then get recent activity with limit
    const { data: bets, error } = await supabase
      .from('bets')
      .select(`
        id,
        amount,
        position,
        created_at,
        outcome_id,
        user_id
      `)
      .eq('prediction_id', prediction_id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching bets:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activity' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user addresses and outcome labels
    const userIds = [...new Set(bets?.map(b => b.user_id) || [])];
    const outcomeIds = [...new Set(bets?.filter(b => b.outcome_id).map(b => b.outcome_id) || [])];

    const [usersResult, outcomesResult] = await Promise.all([
      userIds.length > 0 
        ? supabase.from('users').select('id, ecash_address').in('id', userIds)
        : { data: [] },
      outcomeIds.length > 0 
        ? supabase.from('outcomes').select('id, label').in('id', outcomeIds)
        : { data: [] }
    ]);

    const userMap = new Map((usersResult.data || []).map(u => [u.id, u.ecash_address]));
    const outcomeMap = new Map((outcomesResult.data || []).map(o => [o.id, o.label]));

    const activities = (bets || []).map(b => ({
      id: b.id,
      amount: b.amount,
      position: b.position,
      timestamp: b.created_at,
      address: userMap.get(b.user_id) || 'Unknown',
      outcome_label: b.outcome_id ? outcomeMap.get(b.outcome_id) : undefined
    }));

    console.log(`Fetched ${activities.length} activities (total: ${totalCount || 0}) for prediction ${prediction_id}`);

    return new Response(
      JSON.stringify({ activities, total_count: totalCount || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in get-prediction-activity:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
