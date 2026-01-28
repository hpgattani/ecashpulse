const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scottish Premiership competition ID for football-data.org is 2021
const SCOTTISH_PREMIERSHIP_ID = 2021;

interface MatchData {
  team1: string;
  team2: string;
  team1Score: number | null;
  team2Score: number | null;
  team1Logo: string;
  team2Logo: string;
  status: 'scheduled' | 'in_progress' | 'final' | 'unknown';
  matchTime?: string;
  league: string;
}

// Official team logos from Wikipedia/Wikimedia Commons CDN
const SCOTTISH_TEAM_LOGOS: Record<string, string> = {
  'dundee united': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/fd/Dundee_United_FC_logo.svg/200px-Dundee_United_FC_logo.svg.png',
  'dundee utd': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/fd/Dundee_United_FC_logo.svg/200px-Dundee_United_FC_logo.svg.png',
  'hearts': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/Heart_of_Midlothian_FC_logo.svg/200px-Heart_of_Midlothian_FC_logo.svg.png',
  'heart of midlothian': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/Heart_of_Midlothian_FC_logo.svg/200px-Heart_of_Midlothian_FC_logo.svg.png',
  'celtic': 'https://upload.wikimedia.org/wikipedia/en/thumb/3/35/Celtic_FC.svg/200px-Celtic_FC.svg.png',
  'celtic fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/3/35/Celtic_FC.svg/200px-Celtic_FC.svg.png',
  'rangers': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Rangers_FC.svg/200px-Rangers_FC.svg.png',
  'rangers fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Rangers_FC.svg/200px-Rangers_FC.svg.png',
  'aberdeen': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/Aberdeen_FC_logo.svg/200px-Aberdeen_FC_logo.svg.png',
  'aberdeen fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/Aberdeen_FC_logo.svg/200px-Aberdeen_FC_logo.svg.png',
  'hibernian': 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Hibernian_FC_logo.svg/200px-Hibernian_FC_logo.svg.png',
  'hibernian fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Hibernian_FC_logo.svg/200px-Hibernian_FC_logo.svg.png',
  'hibs': 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Hibernian_FC_logo.svg/200px-Hibernian_FC_logo.svg.png',
  'motherwell': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Motherwell_FC_crest.svg/200px-Motherwell_FC_crest.svg.png',
  'motherwell fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Motherwell_FC_crest.svg/200px-Motherwell_FC_crest.svg.png',
  'st mirren': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/St_Mirren_FC_logo.svg/200px-St_Mirren_FC_logo.svg.png',
  'st. mirren': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/St_Mirren_FC_logo.svg/200px-St_Mirren_FC_logo.svg.png',
  'kilmarnock': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4d/Kilmarnock_FC_logo.svg/200px-Kilmarnock_FC_logo.svg.png',
  'kilmarnock fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4d/Kilmarnock_FC_logo.svg/200px-Kilmarnock_FC_logo.svg.png',
  'ross county': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/Ross_County_F.C._logo.svg/200px-Ross_County_F.C._logo.svg.png',
  'ross county fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/Ross_County_F.C._logo.svg/200px-Ross_County_F.C._logo.svg.png',
  'dundee': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Dundee_FC_2023.svg/200px-Dundee_FC_2023.svg.png',
  'dundee fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Dundee_FC_2023.svg/200px-Dundee_FC_2023.svg.png',
  'st johnstone': 'https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/St_Johnstone_FC_logo.svg/200px-St_Johnstone_FC_logo.svg.png',
  'st. johnstone': 'https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/St_Johnstone_FC_logo.svg/200px-St_Johnstone_FC_logo.svg.png',
  'livingston': 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/Livingston_FC_logo.svg/200px-Livingston_FC_logo.svg.png',
  'livingston fc': 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/Livingston_FC_logo.svg/200px-Livingston_FC_logo.svg.png',
};

function getTeamLogo(teamName: string): string {
  const lower = teamName.toLowerCase();
  for (const [key, url] of Object.entries(SCOTTISH_TEAM_LOGOS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return url;
    }
  }
  return '';
}

function normalizeTeamName(apiName: string): string {
  // Normalize API team names to match our system
  const mappings: Record<string, string> = {
    'Dundee United FC': 'Dundee Utd',
    'Heart of Midlothian FC': 'Hearts',
    'Celtic FC': 'Celtic',
    'Rangers FC': 'Rangers',
    'Aberdeen FC': 'Aberdeen',
    'Hibernian FC': 'Hibernian',
    'Motherwell FC': 'Motherwell',
    'St Mirren FC': 'St Mirren',
    'Kilmarnock FC': 'Kilmarnock',
    'Ross County FC': 'Ross County',
    'Dundee FC': 'Dundee',
    'St Johnstone FC': 'St Johnstone',
    'Livingston FC': 'Livingston',
  };
  return mappings[apiName] || apiName.replace(' FC', '');
}

function parseStatus(status: string): MatchData['status'] {
  const s = status.toUpperCase();
  if (s === 'FINISHED' || s === 'FT') return 'final';
  if (s === 'IN_PLAY' || s === 'LIVE' || s === 'PAUSED' || s.includes('HT')) return 'in_progress';
  if (s === 'SCHEDULED' || s === 'TIMED' || s === 'NS') return 'scheduled';
  return 'unknown';
}

async function fetchLiveScores(team1: string, team2: string): Promise<MatchData | null> {
  const apiKey = Deno.env.get('FOOTBALL_DATA_API_KEY');
  
  if (!apiKey) {
    console.log('No FOOTBALL_DATA_API_KEY configured, using static data');
    return null;
  }

  try {
    // Fetch current matchday fixtures for Scottish Premiership
    const response = await fetch(
      `https://api.football-data.org/v4/competitions/${SCOTTISH_PREMIERSHIP_ID}/matches?status=SCHEDULED,LIVE,IN_PLAY,PAUSED,FINISHED`,
      {
        headers: {
          'X-Auth-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('Football API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const matches = data.matches || [];

    // Find matching game
    const t1Lower = team1.toLowerCase();
    const t2Lower = team2.toLowerCase();

    for (const match of matches) {
      const homeTeam = match.homeTeam?.name?.toLowerCase() || '';
      const awayTeam = match.awayTeam?.name?.toLowerCase() || '';

      // Check if teams match (in either order)
      const matchesT1Home = homeTeam.includes(t1Lower) || t1Lower.includes(homeTeam.split(' ')[0]);
      const matchesT2Away = awayTeam.includes(t2Lower) || t2Lower.includes(awayTeam.split(' ')[0]);
      const matchesT1Away = awayTeam.includes(t1Lower) || t1Lower.includes(awayTeam.split(' ')[0]);
      const matchesT2Home = homeTeam.includes(t2Lower) || t2Lower.includes(homeTeam.split(' ')[0]);

      if ((matchesT1Home && matchesT2Away) || (matchesT1Away && matchesT2Home)) {
        const homeScore = match.score?.fullTime?.home ?? null;
        const awayScore = match.score?.fullTime?.away ?? null;
        
        // If in progress, use current score
        const currentHomeScore = match.score?.halfTime?.home !== undefined 
          ? (homeScore ?? match.score?.halfTime?.home) 
          : homeScore;
        const currentAwayScore = match.score?.halfTime?.away !== undefined 
          ? (awayScore ?? match.score?.halfTime?.away) 
          : awayScore;

        const homeName = normalizeTeamName(match.homeTeam?.name || '');
        const awayName = normalizeTeamName(match.awayTeam?.name || '');

        // Return in request order (team1, team2)
        const team1IsHome = matchesT1Home;

        return {
          team1: team1IsHome ? homeName : awayName,
          team2: team1IsHome ? awayName : homeName,
          team1Score: team1IsHome ? currentHomeScore : currentAwayScore,
          team2Score: team1IsHome ? currentAwayScore : currentHomeScore,
          team1Logo: getTeamLogo(team1IsHome ? homeName : awayName),
          team2Logo: getTeamLogo(team1IsHome ? awayName : homeName),
          status: parseStatus(match.status),
          matchTime: match.utcDate,
          league: 'Scottish Premiership',
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching live scores:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { team1, team2 } = await req.json();
    
    if (!team1 || !team2) {
      return new Response(
        JSON.stringify({ error: 'team1 and team2 are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching score for ${team1} vs ${team2}`);

    // Try to fetch live scores from API
    const liveScore = await fetchLiveScores(team1, team2);
    
    if (liveScore) {
      console.log('Found live score:', liveScore);
      return new Response(
        JSON.stringify(liveScore),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback to static data with correct logos
    const matchData: MatchData = {
      team1: team1,
      team2: team2,
      team1Score: null,
      team2Score: null,
      team1Logo: getTeamLogo(team1),
      team2Logo: getTeamLogo(team2),
      status: 'scheduled',
      league: 'Scottish Premiership',
    };

    console.log('Using static data:', matchData);

    return new Response(
      JSON.stringify(matchData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-scottish-scores:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch scores' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
