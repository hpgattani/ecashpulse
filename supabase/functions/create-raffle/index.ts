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

// Event rosters - Sports + Entertainment
const EVENT_ROSTERS: Record<string, { name: string; category: string; teams: string[] }> = {
  "fifa_world_cup": {
    name: "FIFA World Cup 2026",
    category: "sports",
    teams: ["Argentina", "France", "Brazil", "Germany", "England", "Spain", "Portugal", "Netherlands", "Belgium", "Italy", "USA", "Mexico", "Japan", "South Korea", "Australia", "Morocco", "Senegal", "Canada", "Uruguay", "Croatia", "Denmark", "Switzerland", "Poland", "Serbia", "Ecuador", "Wales", "Ghana", "Cameroon", "Tunisia", "Saudi Arabia", "Iran", "Costa Rica"]
  },
  "nfl_playoffs": {
    name: "NFL Playoffs 2026",
    category: "sports",
    teams: ["Kansas City Chiefs", "Buffalo Bills", "Baltimore Ravens", "Houston Texans", "Cleveland Browns", "Miami Dolphins", "Pittsburgh Steelers", "San Francisco 49ers", "Dallas Cowboys", "Detroit Lions", "Tampa Bay Buccaneers", "Philadelphia Eagles", "Los Angeles Rams", "Green Bay Packers"]
  },
  "nba_finals": {
    name: "NBA Finals 2026",
    category: "sports",
    teams: ["Boston Celtics", "Denver Nuggets", "Milwaukee Bucks", "Phoenix Suns", "Golden State Warriors", "Miami Heat", "Los Angeles Lakers", "Philadelphia 76ers", "New York Knicks", "Dallas Mavericks", "Memphis Grizzlies", "Sacramento Kings", "Cleveland Cavaliers", "Minnesota Timberwolves", "Oklahoma City Thunder", "New Orleans Pelicans"]
  },
  "champions_league": {
    name: "UEFA Champions League 2025/26",
    category: "sports",
    teams: ["Real Madrid", "Manchester City", "Bayern Munich", "Paris Saint-Germain", "Barcelona", "Liverpool", "Chelsea", "Inter Milan", "AC Milan", "Napoli", "Borussia Dortmund", "Arsenal", "Atletico Madrid", "Porto", "Benfica", "Ajax"]
  },
  "oscars": {
    name: "Oscars Best Picture 2026",
    category: "entertainment",
    teams: ["Drama A", "Drama B", "Comedy A", "Action A", "Sci-Fi A", "Animation A", "Foreign Film A", "Documentary A", "Thriller A", "Musical A"]
  },
  "grammys": {
    name: "Grammy Album of the Year 2026",
    category: "entertainment",
    teams: ["Pop Artist A", "Hip-Hop Artist A", "Rock Artist A", "Country Artist A", "R&B Artist A", "Latin Artist A", "Alternative Artist A", "Electronic Artist A"]
  },
  "eurovision": {
    name: "Eurovision 2026",
    category: "entertainment",
    teams: ["Sweden", "Ukraine", "Italy", "France", "Germany", "United Kingdom", "Spain", "Netherlands", "Norway", "Finland", "Switzerland", "Israel", "Australia", "Portugal", "Greece", "Croatia", "Serbia", "Armenia", "Azerbaijan", "Moldova", "Lithuania", "Estonia", "Latvia", "Poland", "Czech Republic"]
  },
  "super_bowl_mvp": {
    name: "Super Bowl MVP 2026",
    category: "sports",
    teams: ["QB Team A", "QB Team B", "RB Team A", "RB Team B", "WR Team A", "WR Team B", "LB Team A", "DE Team B", "CB Team A", "S Team B"]
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event_id, title, description, entry_cost_usd, starts_at, ends_at, session_token, tx_hash } = await req.json();

    console.log("Creating raffle:", { event_id, title, entry_cost_usd });

    // Validate inputs
    if (!event_id || !EVENT_ROSTERS[event_id]) {
      return new Response(JSON.stringify({ error: "Invalid event selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!title || title.length < 5) {
      return new Response(JSON.stringify({ error: "Title must be at least 5 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!session_token) {
      return new Response(JSON.stringify({ error: "Session token required" }), {
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

    // Get user address
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

    const event = EVENT_ROSTERS[event_id];
    const teamCount = event.teams.length;
    
    // Calculate entry cost in XEC based on $USD and team count
    // entry_cost_usd is the total pot value, divided by team count
    const entryXec = Math.ceil(entry_cost_usd / teamCount);

    const creatorAddressHash = await hashAddress(user.ecash_address);

    // Create raffle
    const { data: raffle, error: raffleError } = await supabase
      .from("raffles")
      .insert({
        creator_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        event_type: event.category,
        event_name: event.name,
        teams: event.teams,
        entry_cost: entryXec,
        total_pot: 0,
        status: "open",
        starts_at: starts_at || null,
        ends_at: ends_at || null,
        creation_fee_tx: tx_hash || `raffle_${Date.now()}`,
        creator_address_hash: creatorAddressHash,
      })
      .select()
      .single();

    if (raffleError) {
      console.error("Error creating raffle:", raffleError);
      return new Response(JSON.stringify({ error: "Failed to create raffle" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Raffle created successfully:", raffle.id);

    return new Response(JSON.stringify({ success: true, raffle }), {
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