import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = 0.01; // 1% fee

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🎲 Cron: Checking for expired instant raffles...");

    // Find all instant raffles that have passed their deadline and are still open
    const now = new Date().toISOString();
    const { data: expiredRaffles, error: fetchError } = await supabase
      .from("raffles")
      .select("*")
      .eq("status", "open")
      .eq("event_type", "instant")
      .lt("ends_at", now);

    if (fetchError) {
      console.error("Error fetching expired raffles:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch raffles" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredRaffles || expiredRaffles.length === 0) {
      console.log("No expired instant raffles to resolve");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No raffles to resolve",
        resolved_count: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${expiredRaffles.length} expired instant raffles to resolve`);

    const results = [];

    for (const raffle of expiredRaffles) {
      try {
        console.log(`Resolving instant raffle: ${raffle.id} - ${raffle.title}`);

        // Get all entries for this raffle
        const { data: entries, error: entriesError } = await supabase
          .from("raffle_entries")
          .select("*, users(ecash_address)")
          .eq("raffle_id", raffle.id);

        if (entriesError) {
          console.error(`Error fetching entries for raffle ${raffle.id}:`, entriesError);
          results.push({ raffle_id: raffle.id, success: false, error: "Failed to fetch entries" });
          continue;
        }

        if (!entries || entries.length === 0) {
          // No entries - mark as resolved with no winner
          console.log(`Raffle ${raffle.id} has no entries, marking as resolved`);
          
          await supabase
            .from("raffles")
            .update({
              status: "resolved",
              winner_team: null,
              winner_entry_id: null,
              resolved_at: new Date().toISOString(),
            })
            .eq("id", raffle.id);

          results.push({ 
            raffle_id: raffle.id, 
            success: true, 
            winner: null,
            message: "No entries - no winner" 
          });
          continue;
        }

        // Get all teams that have at least one entry
        const teamsWithEntries = [...new Set(entries.map(e => e.assigned_team))];
        
        if (teamsWithEntries.length === 0) {
          console.log(`Raffle ${raffle.id} has no valid team assignments`);
          results.push({ raffle_id: raffle.id, success: false, error: "No valid teams" });
          continue;
        }

        // Randomly pick a winning team from teams that have entries
        const winningTeam = teamsWithEntries[Math.floor(Math.random() * teamsWithEntries.length)];
        console.log(`Random winning team selected: ${winningTeam}`);

        // Find the entry with the winning team (if multiple, pick one randomly)
        const winningEntries = entries.filter(e => e.assigned_team === winningTeam);
        const winningEntry = winningEntries[Math.floor(Math.random() * winningEntries.length)];

        // Calculate payout
        const platformFee = Math.floor(raffle.total_pot * PLATFORM_FEE_PERCENT);
        const payoutAmount = raffle.total_pot - platformFee;

        console.log(`Winner: Entry ${winningEntry.id}, Team: ${winningTeam}, Pot: ${raffle.total_pot}, Fee: ${platformFee}, Payout: ${payoutAmount}`);

        // Create placeholder payout tx hash
        const payoutTxHash = `instant_raffle_payout_${raffle.id}_${Date.now()}`;

        // Update raffle as resolved
        const { error: updateError } = await supabase
          .from("raffles")
          .update({
            status: "resolved",
            winner_team: winningTeam,
            winner_entry_id: winningEntry.id,
            resolved_at: new Date().toISOString(),
            payout_tx_hash: payoutTxHash,
          })
          .eq("id", raffle.id);

        if (updateError) {
          console.error(`Error updating raffle ${raffle.id}:`, updateError);
          results.push({ raffle_id: raffle.id, success: false, error: "Failed to update raffle" });
          continue;
        }

        results.push({
          raffle_id: raffle.id,
          success: true,
          winning_team: winningTeam,
          winner_entry_id: winningEntry.id,
          payout_amount: payoutAmount,
          platform_fee: platformFee,
          entries_count: entries.length,
        });

        console.log(`✅ Instant raffle ${raffle.id} resolved successfully!`);
      } catch (err: any) {
        console.error(`Error resolving raffle ${raffle.id}:`, err);
        results.push({ raffle_id: raffle.id, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`🎲 Cron complete: Resolved ${successCount}/${expiredRaffles.length} instant raffles`);

    return new Response(JSON.stringify({ 
      success: true, 
      resolved_count: successCount,
      total_checked: expiredRaffles.length,
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Unexpected error in cron-resolve-instant-raffles:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
