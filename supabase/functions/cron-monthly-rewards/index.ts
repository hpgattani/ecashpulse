import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Monthly reward amount in satoshis (configurable)
const MONTHLY_REWARD_SATS = 100000; // 1000 XEC

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Calculate previous month (run on 1st of each month for previous month)
    const now = new Date();
    let targetMonth = now.getMonth(); // 0-indexed, so this is previous month if we run on 1st
    let targetYear = now.getFullYear();
    
    // If running on the 1st, calculate for previous month
    if (now.getDate() <= 7) {
      targetMonth = now.getMonth(); // Current month (0-indexed)
      if (targetMonth === 0) {
        targetMonth = 12;
        targetYear -= 1;
      }
    } else {
      // If running mid-month (manual trigger), use current month
      targetMonth = now.getMonth() + 1;
    }

    console.log(`Calculating monthly rewards for ${targetYear}-${String(targetMonth).padStart(2, '0')}`);

    // Check if rewards already calculated for this month
    const { data: existingReward } = await supabase
      .from('monthly_rewards')
      .select('id')
      .eq('month', targetMonth)
      .eq('year', targetYear)
      .maybeSingle();

    if (existingReward) {
      console.log(`Rewards already calculated for ${targetYear}-${targetMonth}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Rewards already calculated for this month' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate start and end of target month
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    console.log(`Date range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);

    // Find the top predictor by wins count and total profit for the month
    // A "win" is a bet with status = 'won'
    const { data: topPredictors, error: queryError } = await supabase
      .from('bets')
      .select('user_id, amount, payout_amount')
      .eq('status', 'won')
      .gte('confirmed_at', monthStart.toISOString())
      .lte('confirmed_at', monthEnd.toISOString());

    if (queryError) {
      console.error('Error querying bets:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query bets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!topPredictors || topPredictors.length === 0) {
      console.log('No winning bets found for this month');
      return new Response(
        JSON.stringify({ success: true, message: 'No winning bets found for this month' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate wins by user
    const userStats: Record<string, { wins: number; profit: number }> = {};
    
    for (const bet of topPredictors) {
      if (!bet.user_id) continue;
      
      if (!userStats[bet.user_id]) {
        userStats[bet.user_id] = { wins: 0, profit: 0 };
      }
      
      userStats[bet.user_id].wins += 1;
      // Profit = payout - original bet amount
      const profit = (bet.payout_amount || 0) - (bet.amount || 0);
      userStats[bet.user_id].profit += profit;
    }

    // Find the top predictor (most wins, then highest profit as tiebreaker)
    let topUserId: string | null = null;
    let topStats = { wins: 0, profit: 0 };

    for (const [userId, stats] of Object.entries(userStats)) {
      if (
        stats.wins > topStats.wins ||
        (stats.wins === topStats.wins && stats.profit > topStats.profit)
      ) {
        topUserId = userId;
        topStats = stats;
      }
    }

    if (!topUserId) {
      console.log('No eligible winner found');
      return new Response(
        JSON.stringify({ success: true, message: 'No eligible winner found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Top predictor: ${topUserId} with ${topStats.wins} wins and ${topStats.profit} satoshi profit`);

    // Insert the monthly reward
    const { data: reward, error: insertError } = await supabase
      .from('monthly_rewards')
      .insert({
        month: targetMonth,
        year: targetYear,
        user_id: topUserId,
        wins_count: topStats.wins,
        total_profit: topStats.profit,
        reward_amount: MONTHLY_REWARD_SATS,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting reward:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert reward' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Monthly reward created: ${reward.id}`);

    // TODO: Send payout via eCash blockchain (requires escrow wallet integration)
    // For now, just record the reward - payout can be done manually or via separate function

    return new Response(
      JSON.stringify({
        success: true,
        reward: {
          id: reward.id,
          month: targetMonth,
          year: targetYear,
          user_id: topUserId,
          wins_count: topStats.wins,
          total_profit: topStats.profit,
          reward_amount: MONTHLY_REWARD_SATS,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cron-monthly-rewards:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});