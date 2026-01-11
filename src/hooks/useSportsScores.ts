import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GameScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'in_progress' | 'final' | 'unknown';
  league: string;
  period?: number | null;
  clock?: string | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
}

// Minimal mapping for titles we generate.
const NFL_TEAMS: Record<string, string> = {
  jaguars: 'Jacksonville Jaguars',
  bills: 'Buffalo Bills',
  eagles: 'Philadelphia Eagles',
  '49ers': 'San Francisco 49ers',
  rams: 'Los Angeles Rams',
  panthers: 'Carolina Panthers',
  patriots: 'New England Patriots',
  chargers: 'Los Angeles Chargers',
  packers: 'Green Bay Packers',
  bears: 'Chicago Bears',
};

function extractTeamsFromTitle(title: string): { team1: string; team2: string } | null {
  const lower = title.toLowerCase();
  const found: string[] = [];
  for (const [key, full] of Object.entries(NFL_TEAMS)) {
    if (lower.includes(key) && !found.includes(full)) found.push(full);
  }
  if (found.length >= 2) return { team1: found[0], team2: found[1] };
  return null;
}

export function useSportsScores(predictionTitle: string, category: string): GameScore | null {
  const [score, setScore] = useState<GameScore | null>(null);

  const teams = useMemo(() => {
    if (category !== 'sports') return null;
    return extractTeamsFromTitle(predictionTitle);
  }, [predictionTitle, category]);

  useEffect(() => {
    if (category !== 'sports' || !teams) {
      setScore(null);
      return;
    }

    let cancelled = false;
    let interval: number | null = null;

    const fetchScore = async () => {
      const { data, error } = await supabase.functions.invoke('get-nfl-score', {
        body: { team1: teams.team1, team2: teams.team2 },
      });

      if (cancelled) return;

      if (error || !data?.success || !data?.found) {
        setScore({
          homeTeam: teams.team1,
          awayTeam: teams.team2,
          homeScore: null,
          awayScore: null,
          status: 'unknown',
          league: 'NFL',
        });
        return;
      }

      setScore({
        homeTeam: data.homeTeam ?? teams.team1,
        awayTeam: data.awayTeam ?? teams.team2,
        homeScore: data.homeScore ?? null,
        awayScore: data.awayScore ?? null,
        status: data.status ?? 'unknown',
        league: data.league ?? 'NFL',
        period: data.period ?? null,
        clock: data.clock ?? null,
        homeLogo: data.homeLogo ?? null,
        awayLogo: data.awayLogo ?? null,
      });

      // Poll only while live
      if (data.status === 'in_progress' && interval == null) {
        interval = window.setInterval(fetchScore, 60_000);
      }
      if (data.status !== 'in_progress' && interval != null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    fetchScore();

    return () => {
      cancelled = true;
      if (interval != null) window.clearInterval(interval);
    };
  }, [category, teams]);

  return score;
}
