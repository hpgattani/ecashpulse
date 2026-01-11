import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NflScoreStatus = "scheduled" | "in_progress" | "final" | "unknown";

export interface NflScore {
  team1: string; // title order
  team2: string; // title order
  team1Score: number | null;
  team2Score: number | null;
  team1Logo?: string | null;
  team2Logo?: string | null;
  status: NflScoreStatus;
  league: "NFL";
  period?: number | null;
  clock?: string | null;
}

type TeamMatch = { key: string; label: string; patterns: string[] };

const NFL_TEAMS: TeamMatch[] = [
  { key: "cardinals", label: "Arizona Cardinals", patterns: ["arizona cardinals", "cardinals"] },
  { key: "falcons", label: "Atlanta Falcons", patterns: ["atlanta falcons", "falcons"] },
  { key: "ravens", label: "Baltimore Ravens", patterns: ["baltimore ravens", "ravens"] },
  { key: "bills", label: "Buffalo Bills", patterns: ["buffalo bills", "bills"] },
  { key: "panthers", label: "Carolina Panthers", patterns: ["carolina panthers", "panthers"] },
  { key: "bears", label: "Chicago Bears", patterns: ["chicago bears", "bears"] },
  { key: "bengals", label: "Cincinnati Bengals", patterns: ["cincinnati bengals", "bengals"] },
  { key: "browns", label: "Cleveland Browns", patterns: ["cleveland browns", "browns"] },
  { key: "cowboys", label: "Dallas Cowboys", patterns: ["dallas cowboys", "cowboys"] },
  { key: "broncos", label: "Denver Broncos", patterns: ["denver broncos", "broncos"] },
  { key: "lions", label: "Detroit Lions", patterns: ["detroit lions", "lions"] },
  { key: "packers", label: "Green Bay Packers", patterns: ["green bay packers", "packers"] },
  { key: "texans", label: "Houston Texans", patterns: ["houston texans", "texans"] },
  { key: "colts", label: "Indianapolis Colts", patterns: ["indianapolis colts", "colts"] },
  { key: "jaguars", label: "Jacksonville Jaguars", patterns: ["jacksonville jaguars", "jaguars"] },
  { key: "chiefs", label: "Kansas City Chiefs", patterns: ["kansas city chiefs", "chiefs"] },
  { key: "raiders", label: "Las Vegas Raiders", patterns: ["las vegas raiders", "oakland raiders", "raiders"] },
  { key: "chargers", label: "Los Angeles Chargers", patterns: ["los angeles chargers", "la chargers", "chargers"] },
  { key: "rams", label: "Los Angeles Rams", patterns: ["los angeles rams", "la rams", "rams"] },
  { key: "dolphins", label: "Miami Dolphins", patterns: ["miami dolphins", "dolphins"] },
  { key: "vikings", label: "Minnesota Vikings", patterns: ["minnesota vikings", "vikings"] },
  { key: "patriots", label: "New England Patriots", patterns: ["new england patriots", "patriots"] },
  { key: "saints", label: "New Orleans Saints", patterns: ["new orleans saints", "saints"] },
  { key: "giants", label: "New York Giants", patterns: ["new york giants", "giants"] },
  { key: "jets", label: "New York Jets", patterns: ["new york jets", "jets"] },
  { key: "eagles", label: "Philadelphia Eagles", patterns: ["philadelphia eagles", "eagles"] },
  { key: "steelers", label: "Pittsburgh Steelers", patterns: ["pittsburgh steelers", "steelers"] },
  { key: "49ers", label: "San Francisco 49ers", patterns: ["san francisco 49ers", "49ers", "niners"] },
  { key: "seahawks", label: "Seattle Seahawks", patterns: ["seattle seahawks", "seahawks"] },
  { key: "buccaneers", label: "Tampa Bay Buccaneers", patterns: ["tampa bay buccaneers", "buccaneers", "bucs"] },
  { key: "titans", label: "Tennessee Titans", patterns: ["tennessee titans", "titans"] },
  { key: "commanders", label: "Washington Commanders", patterns: ["washington commanders", "commanders", "washington football team", "redskins"] },
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function extractNflTeamsInTitleOrder(title: string): { team1: TeamMatch; team2: TeamMatch } | null {
  const t = normalize(title);

  const hits: Array<{ idx: number; team: TeamMatch }> = [];
  for (const team of NFL_TEAMS) {
    for (const p of team.patterns) {
      const i = t.indexOf(normalize(p));
      if (i !== -1) {
        hits.push({ idx: i, team });
        break;
      }
    }
  }

  // unique by key, in earliest occurrence order
  hits.sort((a, b) => a.idx - b.idx);
  const unique: TeamMatch[] = [];
  for (const h of hits) {
    if (!unique.some((u) => u.key === h.team.key)) unique.push(h.team);
    if (unique.length >= 2) break;
  }

  if (unique.length < 2) return null;
  return { team1: unique[0], team2: unique[1] };
}

export function useNflScoreFromTitle(title: string, enabled: boolean): NflScore | null {
  const match = useMemo(() => (enabled ? extractNflTeamsInTitleOrder(title) : null), [title, enabled]);
  const [score, setScore] = useState<NflScore | null>(null);

  useEffect(() => {
    if (!enabled || !match) {
      setScore(null);
      return;
    }

    let cancelled = false;
    let interval: number | undefined;

    const fetchScore = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-nfl-score", {
          body: { team1: match.team1.label, team2: match.team2.label },
        });

        if (cancelled) return;
        if (error || !data?.found) {
          // Don’t show stale/incorrect data if the scoreboard API fails.
          setScore(null);
          return;
        }

        const homeName = normalize(data.homeTeam || "");
        const awayName = normalize(data.awayTeam || "");
        const t1 = normalize(match.team1.label);
        const t2 = normalize(match.team2.label);

        const pick = (t: string) => {
          const isHome = homeName.includes(t) || t.includes(homeName);
          const isAway = awayName.includes(t) || t.includes(awayName);
          if (isHome) return { score: data.homeScore ?? null, logo: data.homeLogo ?? null };
          if (isAway) return { score: data.awayScore ?? null, logo: data.awayLogo ?? null };
          return null;
        };

        const p1 = pick(t1);
        const p2 = pick(t2);

        setScore({
          team1: match.team1.patterns[1] ? match.team1.patterns[1].replace(/\b\w/g, (c) => c.toUpperCase()) : match.team1.label,
          team2: match.team2.patterns[1] ? match.team2.patterns[1].replace(/\b\w/g, (c) => c.toUpperCase()) : match.team2.label,
          team1Score: p1?.score ?? null,
          team2Score: p2?.score ?? null,
          team1Logo: p1?.logo ?? null,
          team2Logo: p2?.logo ?? null,
          status: (data.status as NflScoreStatus) || "unknown",
          league: "NFL",
          period: data.period ?? null,
          clock: data.clock ?? null,
        });
      } catch {
        if (!cancelled) setScore(null);
      }
    };

    fetchScore();
    interval = window.setInterval(fetchScore, 30_000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [enabled, match]);

  return score;
}
