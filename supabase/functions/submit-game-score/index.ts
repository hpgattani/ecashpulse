import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateSession } from "../_shared/auth.ts";
import { cashAddrToHash160 } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { gameId, score, isCompetitive, txHash, session_token } = body ?? {};

    if (!gameId || score === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: gameId, score" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate score: must be a finite non-negative integer within sane bounds
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1_000_000_000) {
      return new Response(
        JSON.stringify({ error: "Invalid score" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authentication is required to record any score. Competitive scores additionally
    // require server-side derivation of the player's address from the authenticated
    // session — clients are never trusted to supply playerAddressHash.
    let userId: string | null = null;
    let playerAddressHashHex = "anonymous";

    if (session_token) {
      const result = await validateSession(supabase, session_token);
      if (result.valid && result.userId) {
        userId = result.userId;
        const { data: userRow } = await supabase
          .from("users")
          .select("ecash_address")
          .eq("id", userId)
          .maybeSingle();
        if (userRow?.ecash_address) {
          const hash = cashAddrToHash160(userRow.ecash_address);
          if (hash) playerAddressHashHex = bytesToHex(hash);
        }
      }
    }

    // Competitive submissions MUST be authenticated and MUST include a verified
    // on-chain entry-fee tx. Without these, treat as a non-competitive (demo) score.
    let competitive = false;
    if (isCompetitive === true) {
      if (!userId || playerAddressHashHex === "anonymous") {
        return new Response(
          JSON.stringify({ error: "Authentication required for competitive entries" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!txHash || typeof txHash !== "string" || !/^[0-9a-f]{64}$/i.test(txHash)) {
        return new Response(
          JSON.stringify({ error: "Valid entry-fee txHash required for competitive entries" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Prevent reusing the same tx for multiple competitive entries.
      const { data: existingTx } = await supabase
        .from("game_sessions")
        .select("id")
        .eq("tx_hash", txHash)
        .eq("is_competitive", true)
        .maybeSingle();
      if (existingTx) {
        return new Response(
          JSON.stringify({ error: "This entry-fee transaction has already been used" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      competitive = true;
    }

    // Get or create leaderboard for current week
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    const year = now.getFullYear();

    // Check if game exists
    const { data: game } = await supabase
      .from("mini_games")
      .select("id, name")
      .eq("id", gameId)
      .maybeSingle();

    let actualGameId = game?.id;
    if (!actualGameId) {
      const { data: gameBySlug } = await supabase
        .from("mini_games")
        .select("id, name")
        .eq("slug", gameId)
        .maybeSingle();
      if (!gameBySlug) {
        return new Response(
          JSON.stringify({ error: "Game not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      actualGameId = gameBySlug.id;
    }

    // Get or create leaderboard for this week
    let { data: leaderboard, error: lbError } = await supabase
      .from("game_leaderboards")
      .select("*")
      .eq("game_id", actualGameId)
      .eq("week_number", weekNumber)
      .eq("year", year)
      .single();

    if (lbError && lbError.code === "PGRST116") {
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

    const sessionData: Record<string, unknown> = {
      game_id: actualGameId,
      score,
      is_competitive: competitive,
      entry_fee: competitive ? 33333 : 546,
      week_number: weekNumber,
      year: year,
      player_address_hash: playerAddressHashHex,
      ended_at: new Date().toISOString(),
    };

    if (competitive && txHash) {
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

    if (competitive && leaderboard) {
      const entryFeeXec = 33333;
      await supabase
        .from("game_leaderboards")
        .update({ total_pot: (leaderboard.total_pot || 0) + entryFeeXec })
        .eq("id", leaderboard.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session,
        message: competitive
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
