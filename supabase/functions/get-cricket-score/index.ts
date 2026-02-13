import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_URL = 'https://api.cricapi.com/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          }
        });
        clearTimeout(timeout);
        return res;
      } catch (err) {
        console.log(`Attempt ${i + 1} failed:`, err.message);
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
      }
    }
    throw new Error('Fetch failed after retries');
  }

  try {
    const apiKey = Deno.env.get('CRICAPI_KEY');
    if (!apiKey) {
      throw new Error('CRICAPI_KEY not configured');
    }

    const url = new URL(req.url);
    const matchId = url.searchParams.get('match_id');

    if (matchId) {
      const [scorecardRes, matchInfoRes] = await Promise.all([
        fetchWithRetry(`${BASE_URL}/match_scorecard?apikey=${apiKey}&id=${matchId}`),
        fetchWithRetry(`${BASE_URL}/match_info?apikey=${apiKey}&id=${matchId}`),
      ]);
      const [scorecardData, matchInfoData] = await Promise.all([
        scorecardRes.json(),
        matchInfoRes.json(),
      ]);

      return new Response(JSON.stringify({
        scorecard: scorecardData?.data || null,
        matchInfo: matchInfoData?.data || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: fetch current matches and find Scotland vs England
    const res = await fetchWithRetry(`${BASE_URL}/currentMatches?apikey=${apiKey}&offset=0`);
    const data = await res.json();

    if (data.status !== 'success' || !data.data) {
      // Return a graceful fallback with no match
      return new Response(JSON.stringify({ match: null, apiStatus: data.status, info: data.info || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find Scotland vs England match
    const match = data.data.find((m: any) => {
      const teams = (m.teams || []).map((t: string) => t.toLowerCase());
      return teams.some((t: string) => t.includes('scotland')) && 
             teams.some((t: string) => t.includes('england'));
    });

    if (!match) {
      return new Response(JSON.stringify({ match: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse scores
    const scoreArr = match.score || [];
    let team1Score = null;
    let team2Score = null;

    for (const s of scoreArr) {
      const inning = (s.inning || '').toLowerCase();
      if (inning.includes('scotland')) {
        team1Score = `${s.r}/${s.w} (${s.o} ov)`;
      } else if (inning.includes('england')) {
        team2Score = `${s.r}/${s.w} (${s.o} ov)`;
      }
    }

    let status: 'scheduled' | 'in_progress' | 'final' = 'scheduled';
    if (match.matchStarted && !match.matchEnded) status = 'in_progress';
    else if (match.matchEnded) status = 'final';

    return new Response(JSON.stringify({
      match: {
        id: match.id,
        team1: 'Scotland',
        team2: 'England',
        team1Score,
        team2Score,
        status,
        statusText: match.status || '',
        venue: match.venue || '',
        date: match.date || '',
        matchType: match.matchType || 't20',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Cricket score error:', error);
    // Return graceful error - don't break the UI
    return new Response(JSON.stringify({ match: null, error: error.message }), {
      status: 200, // Return 200 so client handles gracefully
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
