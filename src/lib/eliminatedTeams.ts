// FIFA World Cup 2026 — eliminated teams tracker.
// Update this list as teams get knocked out. Names must match those used
// in raffle entries / TEAM_FLAGS (case-sensitive).
export const ELIMINATED_TEAMS: ReadonlySet<string> = new Set([
  // Group stage / Round of 32 / Round of 16 exits go here…
  // Quarter-final exits:
  'Morocco',
]);

export function isEliminated(team: string): boolean {
  return ELIMINATED_TEAMS.has(team);
}
