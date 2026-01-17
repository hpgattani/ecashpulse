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
  },
  "nfl_super_bowl": {
    name: "NFL Super Bowl (All Teams)",
    category: "sports",
    teams: [
      "Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills", "Carolina Panthers", "Chicago Bears",
      "Cincinnati Bengals", "Cleveland Browns", "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers",
      "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs", "Las Vegas Raiders",
      "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins", "Minnesota Vikings", "New England Patriots",
      "New Orleans Saints", "New York Giants", "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers",
      "San Francisco 49ers", "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders"
    ]
  },
  "mlb_world_series": {
    name: "MLB World Series (All Teams)",
    category: "sports",
    teams: [
      "Arizona Diamondbacks", "Atlanta Braves", "Baltimore Orioles", "Boston Red Sox", "Chicago Cubs", "Chicago White Sox",
      "Cincinnati Reds", "Cleveland Guardians", "Colorado Rockies", "Detroit Tigers", "Houston Astros", "Kansas City Royals",
      "Los Angeles Angels", "Los Angeles Dodgers", "Miami Marlins", "Milwaukee Brewers", "Minnesota Twins",
      "New York Mets", "New York Yankees", "Oakland Athletics", "Philadelphia Phillies", "Pittsburgh Pirates",
      "San Diego Padres", "San Francisco Giants", "Seattle Mariners", "St. Louis Cardinals", "Tampa Bay Rays",
      "Texas Rangers", "Toronto Blue Jays", "Washington Nationals"
    ]
  },
  "nhl_stanley_cup": {
    name: "NHL Stanley Cup (All Teams)",
    category: "sports",
    teams: [
      "Anaheim Ducks", "Arizona Coyotes", "Boston Bruins", "Buffalo Sabres", "Calgary Flames", "Carolina Hurricanes",
      "Chicago Blackhawks", "Colorado Avalanche", "Columbus Blue Jackets", "Dallas Stars", "Detroit Red Wings",
      "Edmonton Oilers", "Florida Panthers", "Los Angeles Kings", "Minnesota Wild", "Montreal Canadiens",
      "Nashville Predators", "New Jersey Devils", "New York Islanders", "New York Rangers", "Ottawa Senators",
      "Philadelphia Flyers", "Pittsburgh Penguins", "San Jose Sharks", "Seattle Kraken", "St. Louis Blues",
      "Tampa Bay Lightning", "Toronto Maple Leafs", "Vancouver Canucks", "Vegas Golden Knights", "Washington Capitals",
      "Winnipeg Jets"
    ]
  },
  "the_voice_finale": {
    name: "The Voice Finale (Top 10)",
    category: "entertainment",
    teams: [
      "Contestant 1", "Contestant 2", "Contestant 3", "Contestant 4", "Contestant 5",
      "Contestant 6", "Contestant 7", "Contestant 8", "Contestant 9", "Contestant 10"
    ]
  },
  "t20_world_cup_2026": {
    name: "T20 World Cup 2026",
    category: "sports",
    teams: ["India", "Australia", "England", "Pakistan", "South Africa", "New Zealand", "West Indies", "Sri Lanka", "Bangladesh", "Afghanistan", "Ireland", "Netherlands", "Zimbabwe", "Scotland", "Nepal", "USA", "Canada", "UAE", "Oman", "Namibia"]
  }
};

// Official events that don't require creation fee
const OFFICIAL_EVENTS = ["nfl_super_bowl", "mlb_world_series", "t20_world_cup_2026", "the_voice_finale"];

// Fictional teams for instant raffles
const FICTIONAL_TEAMS = [
  'Phoenix Rising', 'Thunder Wolves', 'Crystal Dragons', 'Shadow Hawks',
  'Golden Lions', 'Arctic Foxes', 'Storm Eagles', 'Crimson Knights',
  'Emerald Titans', 'Silver Serpents', 'Blazing Comets', 'Lunar Owls',
  'Iron Bears', 'Mystic Ravens', 'Neon Tigers', 'Cosmic Falcons'
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { event_id, title, description, entry_cost_usd, entry_cost_xec, starts_at, ends_at, session_token, tx_hash, creation_fee_tx, is_official, skip_creation_fee, is_instant, teams: customTeams } = body;

    console.log("Creating raffle:", { event_id, title, entry_cost_usd, is_instant });

    // For instant raffles, we use fictional teams
    const isInstantRaffle = is_instant === true || event_id === 'instant_raffle';
    
    // Validate inputs
    if (!isInstantRaffle && (!event_id || !EVENT_ROSTERS[event_id])) {
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

    // Handle instant raffles with fictional teams
    let eventName: string;
    let eventCategory: string;
    let teamsList: string[];
    let entryXec: number;
    
    if (isInstantRaffle) {
      // Use custom teams if provided, otherwise use subset of fictional teams
      teamsList = Array.isArray(customTeams) && customTeams.length > 0 
        ? customTeams 
        : FICTIONAL_TEAMS.slice(0, 8);
      eventName = "Instant Raffle";
      eventCategory = "instant";
      entryXec = entry_cost_xec || Math.ceil(1 / 0.00003); // ~$1 default
    } else {
      const event = EVENT_ROSTERS[event_id];
      teamsList = event.teams;
      eventName = event.name;
      eventCategory = event.category;
      
      // Calculate entry cost in XEC based on $USD and team count
      const teamCount = teamsList.length;
      entryXec = Math.ceil(entry_cost_usd / teamCount);
    }

    const creatorAddressHash = await hashAddress(user.ecash_address);

    // Check if this is an official event and if creation fee can be skipped
    const isOfficialEvent = is_official === true && OFFICIAL_EVENTS.includes(event_id);
    // Instant raffles are FREE to create (no creation fee)
    const shouldSkipFee = isOfficialEvent && skip_creation_fee === true || isInstantRaffle;

    // For official events, calculate entry cost in satoshis based on fixed USD price
    const officialEntryCosts: Record<string, number> = {
      "nfl_super_bowl": 2,
      "mlb_world_series": 2,
      "t20_world_cup_2026": 2.50,
      "the_voice_finale": 5,
    };
    
    const finalEntryXec = isOfficialEvent && officialEntryCosts[event_id] 
      ? Math.ceil(officialEntryCosts[event_id] / 0.00003)
      : entryXec;

    // Create raffle
    const { data: raffle, error: raffleError } = await supabase
      .from("raffles")
      .insert({
        creator_id: user.id,
        title: (title || `Instant Raffle #${Date.now().toString().slice(-6)}`).trim(),
        description: description?.trim() || (isInstantRaffle ? "Quick raffle - winner auto-picked at deadline!" : null),
        event_type: eventCategory,
        event_name: eventName,
        teams: teamsList,
        entry_cost: finalEntryXec,
        total_pot: 0,
        status: "open",
        starts_at: starts_at || null,
        ends_at: ends_at || null,
        creation_fee_tx: shouldSkipFee ? `official_${Date.now()}` : (creation_fee_tx || tx_hash || `raffle_${Date.now()}`),
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

    console.log("Raffle created successfully:", raffle.id, isInstantRaffle ? "(instant)" : "");

    return new Response(JSON.stringify({ 
      success: true, 
      raffle, 
      raffle_id: raffle.id, 
      is_official: isOfficialEvent,
      is_instant: isInstantRaffle 
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