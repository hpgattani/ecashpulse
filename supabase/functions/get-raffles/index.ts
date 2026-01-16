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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const raffleId = url.searchParams.get("id");

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
          spots_remaining: teams.length - (entriesCount || 0)
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
        return {
          ...raffle,
          entries_count: count || 0,
          total_spots: teams.length,
          spots_remaining: teams.length - (count || 0)
        };
      })
    );

    return new Response(JSON.stringify({ raffles: rafflesWithCounts }), {
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