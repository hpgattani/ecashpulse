import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserBetSummary = {
  position: string;
  amount: number; // satoshis (XEC * 100)
  outcome_label?: string;
  picks: string[]; // e.g. ["YES"] or ["Team A", "Team B"]
};

type BetRow = {
  prediction_id: string;
  amount: number;
  position: string;
  status: string;
  outcome?: { label?: string | null } | null;
};

let cache:
  | {
      token: string;
      promise: Promise<Record<string, UserBetSummary>> | null;
      data: Record<string, UserBetSummary> | null;
    }
  | null = null;

function buildSummaryMap(bets: BetRow[]): Record<string, UserBetSummary> {
  const byPrediction: Record<
    string,
    { amount: number; picks: Set<string>; positions: Set<string>; outcomeLabel?: string }
  > = {};

  for (const b of bets) {
    if (!b?.prediction_id) continue;
    if (!byPrediction[b.prediction_id]) {
      byPrediction[b.prediction_id] = {
        amount: 0,
        picks: new Set<string>(),
        positions: new Set<string>(),
      };
    }

    const bucket = byPrediction[b.prediction_id];
    bucket.amount += Number(b.amount) || 0;
    bucket.positions.add(String(b.position));

    const outcomeLabel = b.outcome?.label ?? undefined;
    if (outcomeLabel) bucket.outcomeLabel = outcomeLabel;

    const pickLabel = outcomeLabel || String(b.position).toUpperCase();
    bucket.picks.add(pickLabel);
  }

  const map: Record<string, UserBetSummary> = {};
  for (const [predictionId, v] of Object.entries(byPrediction)) {
    const picks = Array.from(v.picks);
    const positions = Array.from(v.positions);

    map[predictionId] = {
      amount: v.amount,
      position: positions.length === 1 ? positions[0] : "multiple",
      outcome_label: picks.length === 1 ? v.outcomeLabel ?? picks[0] : `${picks.length} picks`,
      picks,
    };
  }

  return map;
}

async function fetchBetSummaries(sessionToken: string): Promise<Record<string, UserBetSummary>> {
  const { data, error } = await supabase.functions.invoke("get-user-bets", {
    body: { session_token: sessionToken },
  });

  if (error) throw error;

  const bets = (data?.bets || []) as BetRow[];
  const eligible = bets.filter((b) =>
    ["pending", "confirmed", "won", "lost", "refunded"].includes(String(b.status))
  );
  return buildSummaryMap(eligible);
}

export function useUserBetSummaries() {
  const { sessionToken } = useAuth();
  const [betByPredictionId, setBetByPredictionId] = useState<Record<string, UserBetSummary>>({});
  const [loading, setLoading] = useState(false);

  const token = sessionToken?.trim() || "";

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = Boolean(opts?.force);

      if (!token) {
        setBetByPredictionId({});
        setLoading(false);
        return;
      }

      if (force) {
        cache = null;
      }

      // Serve from cache if available
      if (cache?.token === token && cache.data) {
        setBetByPredictionId(cache.data);
        setLoading(false);
        return;
      }

      setLoading(true);

      if (!cache || cache.token !== token) {
        cache = { token, promise: null, data: null };
      }

      if (!cache.promise) {
        cache.promise = fetchBetSummaries(token)
          .then((map) => {
            cache = { token, promise: null, data: map };
            return map;
          })
          .catch((e) => {
            // reset cache on failure so next try can retry
            cache = null;
            throw e;
          });
      }

      try {
        const map = await cache.promise;
        setBetByPredictionId(map);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh({ force: true });
    window.addEventListener("userbets:refetch", handler);
    return () => window.removeEventListener("userbets:refetch", handler);
  }, [refresh]);

  return useMemo(
    () => ({
      betByPredictionId,
      loading,
      refresh,
    }),
    [betByPredictionId, loading, refresh]
  );
}
