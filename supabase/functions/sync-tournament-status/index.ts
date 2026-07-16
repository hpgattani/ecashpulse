import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOURNAMENT_ID = 'fifa_wc_2026';
const COMPETITION_CODE = 'WC'; // football-data.org FIFA World Cup

interface FdMatch {
  status: string;
  stage: string;
  homeTeam: { name: string | null } | null;
  awayTeam: { name: string | null } | null;
  score?: { winner: string | null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('FOOTBALL_DATA_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_API_KEY not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://api.football-data.org/v4/competitions/${COMPETITION_CODE}/matches`;
    const resp = await fetch(url, { headers: { 'X-Auth-Token': apiKey } });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('football-data error', resp.status, text);
      return new Response(JSON.stringify({ error: 'football-data request failed', status: resp.status }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = await resp.json();
    const matches: FdMatch[] = data.matches ?? [];

    // A team is ALIVE if it appears in any match that is not yet FINISHED.
    // If every match is FINISHED, only the winner of the FINAL is alive.
    const aliveSet = new Set<string>();
    let finalWinner: string | null = null;
    let allFinished = matches.length > 0;

    for (const m of matches) {
      const home = m.homeTeam?.name ?? null;
      const away = m.awayTeam?.name ?? null;
      if (m.status !== 'FINISHED') {
        allFinished = false;
        if (home) aliveSet.add(home);
        if (away) aliveSet.add(away);
      }
      if (m.stage === 'FINAL' && m.status === 'FINISHED') {
        const w = m.score?.winner;
        if (w === 'HOME_TEAM' && home) finalWinner = home;
        else if (w === 'AWAY_TEAM' && away) finalWinner = away;
      }
    }

    let alive: string[];
    if (allFinished && finalWinner) {
      alive = [finalWinner];
    } else {
      alive = Array.from(aliveSet).sort();
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabase
      .from('tournament_status')
      .upsert({
        id: TOURNAMENT_ID,
        alive_teams: alive,
        last_synced_at: new Date().toISOString(),
        source: 'football-data.org',
      });

    if (error) {
      console.error('upsert error', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, tournament: TOURNAMENT_ID, alive, matches_seen: matches.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('sync-tournament-status error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
