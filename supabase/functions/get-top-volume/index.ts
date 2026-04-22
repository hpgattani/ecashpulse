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

    // Pull all confirmed/won/lost bets (volume = sum of stake amounts)
    let allBets: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('bets')
        .select('user_id, amount, status, users!inner(ecash_address)')
        .in('status', ['confirmed', 'won', 'lost'])
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allBets = allBets.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url');
    const profileMap = new Map(
      profiles?.map((p) => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }]) || []
    );

    const userStats: Record<string, {
      ecash_address: string;
      display_name: string | null;
      avatar_url: string | null;
      total_volume: number;
      total_bets: number;
    }> = {};

    for (const bet of allBets) {
      const userId = bet.user_id;
      const address = (bet.users as any)?.ecash_address || '';
      const prof = profileMap.get(userId);
      if (!userStats[userId]) {
        userStats[userId] = {
          ecash_address: address,
          display_name: prof?.display_name || null,
          avatar_url: prof?.avatar_url || null,
          total_volume: 0,
          total_bets: 0,
        };
      }
      userStats[userId].total_volume += bet.amount || 0;
      userStats[userId].total_bets += 1;
    }

    const leaderboard = Object.entries(userStats)
      .map(([user_id, s]) => ({ user_id, ...s }))
      .sort((a, b) => b.total_volume - a.total_volume)
      .slice(0, 50);

    return new Response(
      JSON.stringify({ success: true, leaderboard }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('get-top-volume error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
