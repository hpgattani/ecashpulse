import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = 0.01; // 1% fee
const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { raffle_id, winning_team, admin_secret } = await req.json();

    console.log("Resolving raffle:", { raffle_id, winning_team });

    // Verify admin
    const adminPassword = Deno.env.get("ADMIN_SECRET_PASSWORD");
    if (!admin_secret || admin_secret !== adminPassword) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!raffle_id || !winning_team) {
      return new Response(JSON.stringify({ error: "Missing raffle_id or winning_team" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get raffle
    const { data: raffle, error: raffleError } = await supabase
      .from("raffles")
      .select("*")
      .eq("id", raffle_id)
      .single();

    if (raffleError || !raffle) {
      return new Response(JSON.stringify({ error: "Raffle not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (raffle.status === "resolved") {
      return new Response(JSON.stringify({ error: "Raffle already resolved" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate winning team is in the roster
    const teams = raffle.teams as string[];
    if (!teams.includes(winning_team)) {
      return new Response(JSON.stringify({ error: "Invalid winning team" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the winning entry
    const { data: winningEntry, error: entryError } = await supabase
      .from("raffle_entries")
      .select("*, users(ecash_address)")
      .eq("raffle_id", raffle_id)
      .eq("assigned_team", winning_team)
      .single();

    if (entryError || !winningEntry) {
      // No one picked the winning team - funds go to treasury
      console.log("No winner - winning team was not picked");
      
      await supabase
        .from("raffles")
        .update({
          status: "resolved",
          winner_team: winning_team,
          winner_entry_id: null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", raffle_id);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Raffle resolved - no winner (team not picked)",
        winning_team,
        payout: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate payout (pot minus 1% fee)
    const platformFee = Math.floor(raffle.total_pot * PLATFORM_FEE_PERCENT);
    const payoutAmount = raffle.total_pot - platformFee;

    console.log(`Winner: ${winningEntry.id}, Pot: ${raffle.total_pot}, Fee: ${platformFee}, Payout: ${payoutAmount}`);

    // TODO: Implement actual blockchain payout using ecash-lib
    // For now, mark as resolved and log the payout details
    const payoutTxHash = `raffle_payout_${Date.now()}`; // Placeholder

    // Update raffle as resolved
    await supabase
      .from("raffles")
      .update({
        status: "resolved",
        winner_team: winning_team,
        winner_entry_id: winningEntry.id,
        resolved_at: new Date().toISOString(),
        payout_tx_hash: payoutTxHash,
      })
      .eq("id", raffle_id);

    console.log(`Raffle ${raffle_id} resolved. Winner: ${winning_team}`);

    return new Response(JSON.stringify({ 
      success: true, 
      winning_team,
      winner_entry_id: winningEntry.id,
      payout_amount: payoutAmount,
      platform_fee: platformFee,
      payout_tx_hash: payoutTxHash
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});