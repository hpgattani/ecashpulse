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

    // Fetch all confirmed/won/lost bets with user info
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        user_id,
        status,
        amount,
        payout_amount,
        users!inner(ecash_address)
      `)
      .in('status', ['confirmed', 'won', 'lost']);

    if (betsError) {
      console.error('Error fetching bets:', betsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leaderboard data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also get display names from profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url');

    const profileMap = new Map(profiles?.map(p => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }]) || []);

    // Aggregate stats by user
    const userStats: Record<string, {
      ecash_address: string;
      display_name: string | null;
      avatar_url: string | null;
      total_bets: number;
      total_wins: number;
      total_winnings: number;
      net_profit: number;
    }> = {};

    for (const bet of bets || []) {
      const userId = bet.user_id;
      const address = (bet.users as any)?.ecash_address || '';
      const prof = profileMap.get(userId);

      if (!userStats[userId]) {
        userStats[userId] = {
          ecash_address: address,
          display_name: prof?.display_name || null,
          avatar_url: prof?.avatar_url || null,
          total_bets: 0,
          total_wins: 0,
          total_winnings: 0,
          net_profit: 0,
        };
      }

      userStats[userId].total_bets += 1;
      if (bet.status === 'won') {
        userStats[userId].total_wins += 1;
        userStats[userId].total_winnings += bet.payout_amount || 0;
        userStats[userId].net_profit += (bet.payout_amount || 0) - bet.amount;
      } else if (bet.status === 'lost') {
        userStats[userId].net_profit -= bet.amount;
      }
    }

    // Convert to array - rank by net profit (most profitable first)
    const leaderboard = Object.entries(userStats)
      .map(([user_id, stats]) => ({
        user_id,
        ecash_address: stats.ecash_address,
        display_name: stats.display_name,
        avatar_url: stats.avatar_url,
        total_bets: stats.total_bets,
        total_wins: stats.total_wins,
        total_winnings: stats.total_winnings,
        net_profit: stats.net_profit,
        win_rate: stats.total_bets > 0 
          ? Math.round((stats.total_wins / stats.total_bets) * 100) 
          : 0
      }))
      .filter(l => l.total_bets > 1)
      .sort((a, b) => b.net_profit - a.net_profit)
      .slice(0, 10);

    console.log(`Leaderboard: ${leaderboard.length} winners found`);

    return new Response(
      JSON.stringify({ success: true, leaderboard }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-leaderboard function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
