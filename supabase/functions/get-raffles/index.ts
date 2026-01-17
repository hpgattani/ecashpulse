import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Official event names that are fee-free
const OFFICIAL_EVENT_NAMES = [
  "NFL Super Bowl 2026",
  "MLB World Series 2026", 
  "T20 World Cup 2026",
  "The Voice Season Finale",
  // Also match the exact names from create-raffle
  "NFL Super Bowl (All Teams)",
  "MLB World Series (All Teams)",
  "The Voice Finale (Top 10)",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const raffleId = url.searchParams.get("id");
    
    // Check for official_only in body or query
    let officialOnly = url.searchParams.get("official_only") === "true";
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.official_only) officialOnly = true;
      } catch {
        // Body parsing failed, ignore
      }
    }

    // Helper to check if raffle is official
    const isOfficialRaffle = (eventName: string, creationFeeTx: string | null) => {
      return OFFICIAL_EVENT_NAMES.some(name => eventName.includes(name) || name.includes(eventName)) ||
             (creationFeeTx && creationFeeTx.startsWith("official_"));
    };

    // Get single raffle with entries
    if (raffleId) {
      const { data: raffle, error } = await supabase
        .from("raffles")
        .select("*")
        .eq("id", raffleId)
        .single();

      if (error || !raffle) {
        return new Response(JSON.stringify({ error: "Raffle not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get entries count (not revealing team assignments)
      const { count: entriesCount } = await supabase
        .from("raffle_entries")
        .select("*", { count: "exact", head: true })
        .eq("raffle_id", raffleId);

      const teams = raffle.teams as string[];

      return new Response(JSON.stringify({ 
        raffle: {
          ...raffle,
          entries_count: entriesCount || 0,
          total_spots: teams.length,
          spots_remaining: teams.length - (entriesCount || 0),
          is_official: isOfficialRaffle(raffle.event_name, raffle.creation_fee_tx),
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all raffles
    let query = supabase
      .from("raffles")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: raffles, error } = await query;

    if (error) {
      console.error("Error fetching raffles:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch raffles" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get entry counts for each raffle
    const rafflesWithCounts = await Promise.all(
      (raffles || []).map(async (raffle) => {
        const { count } = await supabase
          .from("raffle_entries")
          .select("*", { count: "exact", head: true })
          .eq("raffle_id", raffle.id);

        const teams = raffle.teams as string[];
        const is_official = isOfficialRaffle(raffle.event_name, raffle.creation_fee_tx);
        
        return {
          ...raffle,
          entries_count: count || 0,
          total_spots: teams.length,
          spots_remaining: teams.length - (count || 0),
          is_official,
        };
      })
    );

    // Filter by official if requested
    const filteredRaffles = officialOnly 
      ? rafflesWithCounts.filter(r => r.is_official)
      : rafflesWithCounts;

    return new Response(JSON.stringify({ raffles: filteredRaffles }), {
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