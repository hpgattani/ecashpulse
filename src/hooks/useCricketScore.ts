import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CricketScore {
  id: string;
  team1: string;
  team2: string;
  team1Score: string | null;
  team2Score: string | null;
  status: 'scheduled' | 'in_progress' | 'final';
  statusText: string;
  venue: string;
  date: string;
  matchType: string;
}

export interface CricketScorecard {
  scorecard: any;
  matchInfo: any;
}

export function useCricketScore(enabled: boolean) {
  const [score, setScore] = useState<CricketScore | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchScore = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-cricket-score');
      if (error) throw error;
      if (data?.match) {
        setScore(data.match);
      }
    } catch (err) {
      console.error('Cricket score fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchScore();
    // Poll every 30 seconds during live matches
    const interval = setInterval(fetchScore, 30000);
    return () => clearInterval(interval);
  }, [enabled, fetchScore]);

  return { score, loading };
}

export function useCricketScorecard(matchId: string | null) {
  const [scorecard, setScorecard] = useState<CricketScorecard | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchScorecard = useCallback(async () => {
    if (!matchId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-cricket-score', {
        body: null,
        headers: {},
      });
      // Use query params via URL
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-cricket-score?match_id=${matchId}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
      const result = await res.json();
      if (result) {
        setScorecard(result);
      }
    } catch (err) {
      console.error('Cricket scorecard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchScorecard();
  }, [fetchScorecard]);

  return { scorecard, loading, refetch: fetchScorecard };
}
