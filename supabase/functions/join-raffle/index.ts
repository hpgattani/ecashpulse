import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash address for anonymity
async function hashAddress(address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(address);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Shuffle array using Fisher-Yates
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { raffle_id, session_token, tx_hash } = await req.json();

    console.log("Joining raffle:", { raffle_id });

    if (!raffle_id || !session_token) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", session_token)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, ecash_address")
      .eq("id", session.user_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
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

    if (raffle.status !== "open") {
      return new Response(JSON.stringify({ error: "Raffle is no longer open" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing entries to find available teams
    const { data: existingEntries, error: entriesError } = await supabase
      .from("raffle_entries")
      .select("assigned_team, participant_address_hash")
      .eq("raffle_id", raffle_id);

    if (entriesError) {
      console.error("Error fetching entries:", entriesError);
      return new Response(JSON.stringify({ error: "Failed to check entries" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const participantHash = await hashAddress(user.ecash_address);

    // Check if user already has an entry (a "ticket" = N team rows for this user)
    const userHasEntry = existingEntries?.some(e => e.participant_address_hash === participantHash);
    if (userHasEntry) {
      return new Response(JSON.stringify({ error: "You already have a ticket in this raffle" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const takenTeams = existingEntries?.map(e => e.assigned_team) || [];
    const allTeams = raffle.teams as string[];
    const availableTeams = allTeams.filter(t => !takenTeams.includes(t));

    if (availableTeams.length === 0) {
      return new Response(JSON.stringify({ error: "All teams have been claimed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teamsPerEntry = Math.max(1, Number((raffle as any).teams_per_entry) || 1);
    const teamsToAssign = Math.min(teamsPerEntry, availableTeams.length);

    // Randomly assign N teams in a single ticket purchase
    const shuffled = shuffleArray(availableTeams);
    const assignedTeams = shuffled.slice(0, teamsToAssign);

    // Create entry rows (one per assigned team, sharing the same tx_hash)
    const sharedTxHash = tx_hash || `entry_${Date.now()}`;
    const rows = assignedTeams.map((team) => ({
      raffle_id,
      user_id: user.id,
      assigned_team: team,
      amount_paid: raffle.entry_cost,
      tx_hash: sharedTxHash,
      participant_address_hash: participantHash,
    }));

    const { data: entries, error: entryError } = await supabase
      .from("raffle_entries")
      .insert(rows)
      .select();

    if (entryError) {
      console.error("Error creating entry:", entryError);
      return new Response(JSON.stringify({ error: "Failed to join raffle" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update raffle total pot (one ticket = one entry_cost regardless of teams_per_entry)
    const newPot = raffle.total_pot + raffle.entry_cost;
    const remainingSpots = availableTeams.length - teamsToAssign;

    // If all spots filled, mark raffle as full
    const newStatus = remainingSpots === 0 ? "full" : "open";

    await supabase
      .from("raffles")
      .update({ total_pot: newPot, status: newStatus })
      .eq("id", raffle_id);

    console.log(`User joined raffle ${raffle_id}, assigned teams: ${assignedTeams.join(", ")}`);

    // Reveal teams only once the raffle is fully sold out.
    const isFull = remainingSpots === 0;

    return new Response(JSON.stringify({
      success: true,
      entry: entries?.[0],
      entries: isFull ? entries : entries?.map((e: any) => ({ ...e, assigned_team: null })),
      assigned_team: isFull ? assignedTeams[0] : null,
      assigned_teams: isFull ? assignedTeams : [],
      pending_reveal: !isFull,
      remaining_spots: remainingSpots,
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