import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------- PAYOUT LOGIC FOR BINARY (YES/NO) ----------------
async function processPayoutsBinary(
  supabase: any,
  predictionId: string,
  winningPosition: "yes" | "no",
): Promise<{ winners: number; totalPayout: number }> {
  const { data: prediction } = await supabase
    .from("predictions")
    .select("yes_pool, no_pool")
    .eq("id", predictionId)
    .single();

  if (!prediction) throw new Error("Prediction not found");

  const totalPool = prediction.yes_pool + prediction.no_pool;
  const winningPool = winningPosition === "yes" ? prediction.yes_pool : prediction.no_pool;

  const { data: winningBets } = await supabase
    .from("bets")
    .select("id, amount")
    .eq("prediction_id", predictionId)
    .eq("position", winningPosition)
    .eq("status", "confirmed");

  if (!winningBets || winningBets.length === 0) {
    return { winners: 0, totalPayout: 0 };
  }

  let totalPayout = 0;

  for (const bet of winningBets) {
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : bet.amount;
    totalPayout += payout;
    await supabase.from("bets").update({ status: "won", payout_amount: payout }).eq("id", bet.id);
  }

  // Mark losing bets
  await supabase
    .from("bets")
    .update({ status: "lost", payout_amount: 0 })
    .eq("prediction_id", predictionId)
    .eq("position", winningPosition === "yes" ? "no" : "yes")
    .eq("status", "confirmed");

  // Trigger payout function
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-payouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ prediction_id: predictionId }),
  });

  return { winners: winningBets.length, totalPayout };
}

// ---------------- PAYOUT LOGIC FOR MULTI-OUTCOME ----------------
async function processPayoutsMultiOutcome(
  supabase: any,
  predictionId: string,
  winningOutcomeId: string,
): Promise<{ winners: number; totalPayout: number }> {
  // Get all outcomes for total pool calculation
  const { data: outcomes } = await supabase
    .from("outcomes")
    .select("id, label, pool")
    .eq("prediction_id", predictionId);

  if (!outcomes || outcomes.length === 0) {
    throw new Error("No outcomes found for prediction");
  }

  // Calculate total pool from all outcomes
  const totalPool = outcomes.reduce((sum: number, o: any) => sum + (o.pool || 0), 0);
  
  // Find winning outcome
  const winningOutcome = outcomes.find((o: any) => o.id === winningOutcomeId);
  if (!winningOutcome) {
    throw new Error(`Winning outcome ${winningOutcomeId} not found`);
  }

  const winningPool = winningOutcome.pool || 0;

  console.log(`Multi-outcome resolution: ${winningOutcome.label}`);
  console.log(`Total pool: ${totalPool}, Winning pool: ${winningPool}`);

  // Get winning bets (those who bet on the winning outcome_id)
  const { data: winningBets } = await supabase
    .from("bets")
    .select("id, amount, outcome_id")
    .eq("prediction_id", predictionId)
    .eq("outcome_id", winningOutcomeId)
    .eq("status", "confirmed");

  if (!winningBets || winningBets.length === 0) {
    // No winners - mark all bets as lost
    await supabase
      .from("bets")
      .update({ status: "lost", payout_amount: 0 })
      .eq("prediction_id", predictionId)
      .eq("status", "confirmed");

    return { winners: 0, totalPayout: 0 };
  }

  let totalPayout = 0;

  // Calculate payouts for winners
  for (const bet of winningBets) {
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : bet.amount;
    totalPayout += payout;
    await supabase.from("bets").update({ status: "won", payout_amount: payout }).eq("id", bet.id);
  }

  // Mark losing bets (those who bet on other outcomes)
  await supabase
    .from("bets")
    .update({ status: "lost", payout_amount: 0 })
    .eq("prediction_id", predictionId)
    .neq("outcome_id", winningOutcomeId)
    .eq("status", "confirmed");

  // Trigger payout function
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-payouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ prediction_id: predictionId }),
  });

  return { winners: winningBets.length, totalPayout };
}

// ---------------- ADMIN AUTH CHECK ----------------
async function verifyAdminSession(supabase: any, sessionToken: string): Promise<boolean> {
  if (!sessionToken) return false;
  
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', sessionToken)
    .single();
  
  if (!session || new Date(session.expires_at) < new Date()) return false;
  
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user_id)
    .eq('role', 'admin')
    .single();
  
  return !!role;
}

// ---------------- MAIN HANDLER ----------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { prediction_id, outcome, winning_outcome_id, session_token, force } = await req.json();

    if (!prediction_id) {
      return new Response(JSON.stringify({ error: "prediction_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require admin session for manual resolution
    if (session_token) {
      const isAdmin = await verifyAdminSession(supabase, session_token);
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ---- FETCH PREDICTION ----
    const { data: prediction, error } = await supabase
      .from("predictions")
      .select("status, end_date, resolution_date")
      .eq("id", prediction_id)
      .single();

    if (error || !prediction) {
      return new Response(JSON.stringify({ error: "Prediction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- BLOCK DOUBLE RESOLUTION ----
    if (prediction.status?.startsWith("resolved")) {
      return new Response(JSON.stringify({ error: "Prediction already resolved" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- CHECK IF BETTING PERIOD HAS ENDED (skip if force=true for admin) ----
    const now = new Date();
    const endDate = new Date(prediction.end_date);
    
    if (now < endDate && !force) {
      return new Response(
        JSON.stringify({
          error: "Betting period not yet ended",
          end_date: prediction.end_date,
        }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- CHECK IF MULTI-OUTCOME OR BINARY ----
    const { data: outcomes } = await supabase
      .from("outcomes")
      .select("id, label")
      .eq("prediction_id", prediction_id);

    const isMultiOutcome = outcomes && outcomes.length > 0;

    let payoutResult: { winners: number; totalPayout: number };
    let newStatus: string;
    let resolvedOutcomeLabel: string | undefined;

    if (isMultiOutcome) {
      // ---- MULTI-OUTCOME RESOLUTION ----
      if (!winning_outcome_id) {
        // Return available outcomes for admin to choose
        return new Response(
          JSON.stringify({
            error: "winning_outcome_id required for multi-outcome prediction",
            available_outcomes: outcomes,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const winningOutcome = outcomes.find((o: any) => o.id === winning_outcome_id);
      if (!winningOutcome) {
        return new Response(
          JSON.stringify({
            error: "Invalid winning_outcome_id",
            available_outcomes: outcomes,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      newStatus = `resolved_${winningOutcome.label.toLowerCase().replace(/\s+/g, '_')}`;
      resolvedOutcomeLabel = winningOutcome.label;

      console.info(`Resolving multi-outcome prediction ${prediction_id} with winner: ${winningOutcome.label}`);

      payoutResult = await processPayoutsMultiOutcome(supabase, prediction_id, winning_outcome_id);

    } else {
      // ---- BINARY (YES/NO) RESOLUTION ----
      if (!["yes", "no"].includes(outcome)) {
        return new Response(JSON.stringify({ error: "Invalid outcome (must be 'yes' or 'no')" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      newStatus = outcome === "yes" ? "resolved_yes" : "resolved_no";

      console.info(`Resolving binary prediction ${prediction_id} as ${outcome}`);

      payoutResult = await processPayoutsBinary(supabase, prediction_id, outcome);
    }

    // ---- UPDATE PREDICTION STATUS ----
    const { error: updateError } = await supabase
      .from("predictions")
      .update({
        status: newStatus,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", prediction_id);

    if (updateError) {
      console.error("Failed to update prediction status:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update prediction" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.info(`Payouts processed: ${payoutResult.winners} winners, ${payoutResult.totalPayout} total`);

    return new Response(
      JSON.stringify({
        success: true,
        prediction_id,
        outcome: resolvedOutcomeLabel || outcome,
        status: newStatus,
        winners: payoutResult.winners,
        total_payout: payoutResult.totalPayout,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Resolution error:", err);
    return new Response(JSON.stringify({ error: "Resolution failed", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
