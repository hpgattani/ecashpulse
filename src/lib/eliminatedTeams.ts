// FIFA World Cup 2026 — teams still able to win the trophy.
// Third-place play-off teams are NOT alive (they can't win the Cup).
// Names must match those used in raffle entries / TEAM_FLAGS (case-sensitive).
export const ALIVE_TEAMS: ReadonlySet<string> = new Set([
  // Finalists only
  'Spain',
  'Argentina',
]);

export function isEliminated(team: string): boolean {
  return !ALIVE_TEAMS.has(team);
}
