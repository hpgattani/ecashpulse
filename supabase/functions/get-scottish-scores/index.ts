const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Static team data - logos are handled client-side with local assets
// This endpoint provides score updates when available
const SCOTTISH_TEAMS: Record<string, { name: string }> = {
  'dundee united': { name: 'Dundee Utd' },
  'dundee utd': { name: 'Dundee Utd' },
  'hearts': { name: 'Hearts' },
  'heart of midlothian': { name: 'Hearts' },
  'celtic': { name: 'Celtic' },
  'rangers': { name: 'Rangers' },
  'aberdeen': { name: 'Aberdeen' },
  'hibernian': { name: 'Hibernian' },
  'hibs': { name: 'Hibernian' },
  'motherwell': { name: 'Motherwell' },
  'st mirren': { name: 'St Mirren' },
  'kilmarnock': { name: 'Kilmarnock' },
  'ross county': { name: 'Ross County' },
  'dundee': { name: 'Dundee' },
  'st johnstone': { name: 'St Johnstone' },
  'livingston': { name: 'Livingston' },
};

function normalizeTeamName(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, data] of Object.entries(SCOTTISH_TEAMS)) {
    if (lower.includes(key)) {
      return data.name;
    }
  }
  return input;
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

    // Return normalized team data - logos handled client-side
    const matchData: MatchData = {
      team1: normalizeTeamName(team1),
      team2: normalizeTeamName(team2),
      team1Score: null,
      team2Score: null,
      team1Logo: '', // Logos handled client-side with local assets
      team2Logo: '',
      status: 'scheduled',
      league: 'Scottish Premiership',
    };

    console.log('Match data:', matchData);

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
