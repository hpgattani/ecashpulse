import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------- PAYOUT LOGIC ----------------
async function processPayouts(
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
    const { prediction_id, outcome } = await req.json();

    if (!prediction_id || !["yes", "no"].includes(outcome)) {
      return new Response(JSON.stringify({ error: "Invalid prediction_id or outcome" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- FETCH PREDICTION (using actual schema columns) ----
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

    // ---- CHECK IF BETTING PERIOD HAS ENDED ----
    const now = new Date();
    const endDate = new Date(prediction.end_date);
    
    if (now < endDate) {
      return new Response(
        JSON.stringify({
          error: "Betting period not yet ended",
          end_date: prediction.end_date,
        }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- RESOLVE ----
    const newStatus = outcome === "yes" ? "resolved_yes" : "resolved_no";

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

    console.info(`Prediction ${prediction_id} resolved as ${outcome}`);

    const payoutResult = await processPayouts(supabase, prediction_id, outcome);

    console.info(`Payouts processed: ${payoutResult.winners} winners, ${payoutResult.totalPayout} total`);

    return new Response(
      JSON.stringify({
        success: true,
        prediction_id,
        outcome,
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
