// FIFA World Cup 2026 — teams still alive in the knockout stage.
// Update this list as more teams get knocked out.
// Names must match those used in raffle entries / TEAM_FLAGS (case-sensitive).
export const ALIVE_TEAMS: ReadonlySet<string> = new Set([
  // Quarter-finalists still in the tournament:
  'Spain',
  'England',
  'Argentina',
  // France lost to Spain (0-2) in the semi-final → eliminated.
  // Switzerland eliminated in quarter-finals.
]);

export function isEliminated(team: string): boolean {
  return !ALIVE_TEAMS.has(team);
}
