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
      .select('user_id, display_name');

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

    // Aggregate stats by user
    const userStats: Record<string, {
      ecash_address: string;
      display_name: string | null;
      total_bets: number;
      total_wins: number;
      total_winnings: number;
    }> = {};

    for (const bet of bets || []) {
      const userId = bet.user_id;
      const address = (bet.users as any)?.ecash_address || '';

      if (!userStats[userId]) {
        userStats[userId] = {
          ecash_address: address,
          display_name: profileMap.get(userId) || null,
          total_bets: 0,
          total_wins: 0,
          total_winnings: 0,
        };
      }

      userStats[userId].total_bets += 1;
      if (bet.status === 'won') {
        userStats[userId].total_wins += 1;
        userStats[userId].total_winnings += bet.payout_amount || 0;
      }
    }

    // Convert to array - only users with wins and more than 1 bet
    const leaderboard = Object.entries(userStats)
      .map(([user_id, stats]) => ({
        user_id,
        ecash_address: stats.ecash_address,
        display_name: stats.display_name,
        total_bets: stats.total_bets,
        total_wins: stats.total_wins,
        total_winnings: stats.total_winnings,
        win_rate: stats.total_bets > 0 
          ? Math.round((stats.total_wins / stats.total_bets) * 100) 
          : 0
      }))
      .filter(l => l.total_wins >= 2 && l.total_bets > 1)
      .map(l => {
        // Combination score: weighted formula
        // 40% wins (normalized), 35% winnings (log-scaled), 25% win rate
        const winsScore = l.total_wins;
        const winningsScore = l.total_winnings > 0 ? Math.log10(l.total_winnings) : 0;
        const winRateScore = l.win_rate / 100;
        l.combo_score = (winsScore * 0.4) + (winningsScore * 3.5) + (winRateScore * 2.5);
        return l;
      })
      .sort((a, b) => (b as any).combo_score - (a as any).combo_score)
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
