const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Scottish Premiership league ID for API-Football is 179
// For football-data.org, Scotland's league code is "SPL" or competition ID 2021

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
  'rangers': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Rangers_FC.svg/200px-Rangers_FC.svg.png',
  'aberdeen': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/Aberdeen_FC_logo.svg/200px-Aberdeen_FC_logo.svg.png',
  'hibernian': 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Hibernian_FC_logo.svg/200px-Hibernian_FC_logo.svg.png',
  'hibs': 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Hibernian_FC_logo.svg/200px-Hibernian_FC_logo.svg.png',
  'motherwell': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Motherwell_FC_crest.svg/200px-Motherwell_FC_crest.svg.png',
  'st mirren': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/St_Mirren_FC_logo.svg/200px-St_Mirren_FC_logo.svg.png',
  'kilmarnock': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4d/Kilmarnock_FC_logo.svg/200px-Kilmarnock_FC_logo.svg.png',
  'ross county': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/Ross_County_F.C._logo.svg/200px-Ross_County_F.C._logo.svg.png',
  'dundee': 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Dundee_FC_2023.svg/200px-Dundee_FC_2023.svg.png',
  'st johnstone': 'https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/St_Johnstone_FC_logo.svg/200px-St_Johnstone_FC_logo.svg.png',
  'livingston': 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/Livingston_FC_logo.svg/200px-Livingston_FC_logo.svg.png',
};

function getTeamLogo(teamName: string): string {
  const lower = teamName.toLowerCase();
  for (const [key, url] of Object.entries(SCOTTISH_TEAM_LOGOS)) {
    if (lower.includes(key)) {
      return url;
    }
  }
  return '';
}

function parseStatus(status: string): MatchData['status'] {
  const s = status.toUpperCase();
  if (s === 'FINISHED' || s === 'FT') return 'final';
  if (s === 'IN_PLAY' || s === 'LIVE' || s.includes('HT') || s.match(/^\d+$/)) return 'in_progress';
  if (s === 'SCHEDULED' || s === 'TIMED' || s === 'NS') return 'scheduled';
  return 'unknown';
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

    // For now, return static data with correct logos
    // In production, this would fetch from football-data.org or API-Football
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

    return new Response(
      JSON.stringify(matchData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Scottish scores:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch scores' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
