import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fallback if the DB row is missing or stale — matches current WC 2026 state.
const FALLBACK_ALIVE: ReadonlyArray<string> = ['Spain', 'Argentina', 'France', 'England'];

export const TOURNAMENT_ID = 'fifa_wc_2026';

async function fetchAliveTeams(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tournament_status')
    .select('alive_teams')
    .eq('id', TOURNAMENT_ID)
    .maybeSingle();

  if (error) {
    console.warn('tournament_status fetch failed, using fallback:', error.message);
    return [...FALLBACK_ALIVE];
  }
  const teams = (data?.alive_teams as string[] | null) ?? null;
  if (!teams || teams.length === 0) return [...FALLBACK_ALIVE];
  return teams;
}

export function useAliveTeams() {
  const query = useQuery({
    queryKey: ['tournament_status', TOURNAMENT_ID],
    queryFn: fetchAliveTeams,
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
    placeholderData: [...FALLBACK_ALIVE],
  });

  const aliveSet = new Set(query.data ?? FALLBACK_ALIVE);
  return {
    aliveTeams: query.data ?? [...FALLBACK_ALIVE],
    isEliminated: (team: string) => !aliveSet.has(team),
    isLoading: query.isLoading,
  };
}
