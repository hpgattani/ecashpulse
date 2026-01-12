import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get total bets and volume (confirmed bets only)
    const { data: betStats, error: betError } = await supabase
      .from('bets')
      .select('amount, user_id, status, payout_amount')
      .in('status', ['confirmed', 'won', 'lost', 'refunded']);

    if (betError) throw betError;

    const totalBets = betStats?.length || 0;
    const totalVolume = betStats?.reduce((sum, bet) => sum + (bet.amount || 0), 0) || 0;
    const uniqueUsers = new Set(betStats?.map(bet => bet.user_id)).size;
    const totalWon = betStats?.filter(b => b.status === 'won').reduce((sum, bet) => sum + (bet.payout_amount || 0), 0) || 0;

    // Get prediction count
    const { count: predictionCount, error: predError } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true });

    if (predError) throw predError;

    // Get resolved predictions count
    const { count: resolvedCount, error: resolvedError } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['resolved_yes', 'resolved_no']);

    if (resolvedError) throw resolvedError;

    // Get total users
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (userError) throw userError;

    return new Response(
      JSON.stringify({
        totalBets,
        totalVolume,
        uniqueBettors: uniqueUsers,
        totalUsers: userCount || 0,
        totalWon,
        totalPredictions: predictionCount || 0,
        resolvedPredictions: resolvedCount || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error fetching platform stats:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
