// FIFA World Cup 2026 — teams still alive in the knockout stage.
// Update this list as more teams get knocked out.
// Names must match those used in raffle entries / TEAM_FLAGS (case-sensitive).
export const ALIVE_TEAMS: ReadonlySet<string> = new Set([
  // Quarter-finalists still in the tournament:
  'France',
  'Spain',
  
  'Norway',
  'England',
  'Argentina',
  'Switzerland',
  // Morocco lost to France (2-0) → eliminated.
]);

export function isEliminated(team: string): boolean {
  return !ALIVE_TEAMS.has(team);
}
