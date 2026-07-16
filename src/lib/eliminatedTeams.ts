// FIFA World Cup 2026 — teams still alive in the knockout stage.
// Update this list as more teams get knocked out.
// Names must match those used in raffle entries / TEAM_FLAGS (case-sensitive).
export const ALIVE_TEAMS: ReadonlySet<string> = new Set([
  // Semi-finalists: Spain vs Argentina
  'Spain',
  'Argentina',
  // Third-place play-off: France vs England
  'France',
  'England',
]);

export function isEliminated(team: string): boolean {
  return !ALIVE_TEAMS.has(team);
}
