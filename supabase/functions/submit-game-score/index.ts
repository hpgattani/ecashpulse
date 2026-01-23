import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { gameId, score, isCompetitive, txHash, playerAddressHash } = await req.json();

    if (!gameId || score === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: gameId, score" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create leaderboard for current week
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    const year = now.getFullYear();

    // Check if game exists
    const { data: game, error: gameError } = await supabase
      .from("mini_games")
      .select("id, name")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      // Try by slug
      const { data: gameBySlug, error: slugError } = await supabase
        .from("mini_games")
        .select("id, name")
        .eq("slug", gameId)
        .single();

      if (slugError || !gameBySlug) {
        return new Response(
          JSON.stringify({ error: "Game not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const actualGameId = game?.id || gameId;

    // Get or create leaderboard for this week
    let { data: leaderboard, error: lbError } = await supabase
      .from("game_leaderboards")
      .select("*")
      .eq("game_id", actualGameId)
      .eq("week_number", weekNumber)
      .eq("year", year)
      .single();

    if (lbError && lbError.code === "PGRST116") {
      // Create new leaderboard for this week
      const { data: newLb, error: createError } = await supabase
        .from("game_leaderboards")
        .insert({
          game_id: actualGameId,
          week_number: weekNumber,
          year: year,
          total_pot: 0,
          status: "active",
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating leaderboard:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create leaderboard" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      leaderboard = newLb;
    }

    // Record the game session
    const sessionData: any = {
      game_id: actualGameId,
      score,
      is_competitive: isCompetitive || false,
      entry_fee: isCompetitive ? 33333 : 546, // ~$1 or demo fee in satoshis
      week_number: weekNumber,
      year: year,
      player_address_hash: playerAddressHash || "anonymous",
      ended_at: new Date().toISOString(),
    };

    if (txHash) {
      sessionData.tx_hash = txHash;
    }

    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .insert(sessionData)
      .select()
      .single();

    if (sessionError) {
      console.error("Error creating game session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to record game session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If competitive, update the leaderboard pot
    if (isCompetitive && leaderboard) {
      const entryFeeXec = 33333; // ~$1 worth of XEC
      await supabase
        .from("game_leaderboards")
        .update({ total_pot: (leaderboard.total_pot || 0) + entryFeeXec })
        .eq("id", leaderboard.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: session,
        message: isCompetitive
          ? "Score recorded! Check the leaderboard for your ranking."
          : "Demo score recorded.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in submit-game-score:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
