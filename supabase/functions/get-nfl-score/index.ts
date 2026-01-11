import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ScoreStatus = 'scheduled' | 'in_progress' | 'final' | 'unknown';

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    let team1 = url.searchParams.get('team1') || '';
    let team2 = url.searchParams.get('team2') || '';

    if (!team1 || !team2) {
      // allow JSON body
      try {
        const body = await req.json();
        team1 = body?.team1 || team1;
        team2 = body?.team2 || team2;
      } catch {
        // ignore
      }
    }

    if (!team1 || !team2) {
      return new Response(
        JSON.stringify({ success: false, error: 'team1 and team2 are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scoreboardRes = await fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard');
    if (!scoreboardRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch scoreboard' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scoreboard = await scoreboardRes.json();
    const events = scoreboard?.events || [];

    const t1 = normalize(team1);
    const t2 = normalize(team2);

    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      const competitors = comp?.competitors || [];
      if (competitors.length < 2) continue;

      const names = competitors.map((c: any) => normalize(c?.team?.displayName || c?.team?.name || ''));
      const has1 = names.some((n: string) => n.includes(t1) || t1.includes(n));
      const has2 = names.some((n: string) => n.includes(t2) || t2.includes(n));
      if (!has1 || !has2) continue;

      const home = competitors.find((c: any) => c?.homeAway === 'home') || competitors[0];
      const away = competitors.find((c: any) => c?.homeAway === 'away') || competitors[1];

      const statusObj = comp?.status?.type;
      const state = statusObj?.state as string | undefined; // pre, in, post
      const completed = Boolean(statusObj?.completed);

      let status: ScoreStatus = 'unknown';
      if (completed || state === 'post') status = 'final';
      else if (state === 'in') status = 'in_progress';
      else if (state === 'pre') status = 'scheduled';

      const period = comp?.status?.period ?? null;
      const clock = comp?.status?.displayClock ?? null;

      return new Response(
        JSON.stringify({
          success: true,
          found: true,
          league: 'NFL',
          status,
          period,
          clock,
          homeTeam: home?.team?.displayName ?? null,
          awayTeam: away?.team?.displayName ?? null,
          homeScore: home?.score != null ? Number(home.score) : null,
          awayScore: away?.score != null ? Number(away.score) : null,
          homeLogo: home?.team?.logo ?? null,
          awayLogo: away?.team?.logo ?? null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, found: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('get-nfl-score error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
