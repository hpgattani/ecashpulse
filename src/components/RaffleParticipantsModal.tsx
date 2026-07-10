import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isEliminated } from '@/lib/eliminatedTeams';
import { getTeamFlag } from '@/lib/teamFlags';

interface RaffleParticipantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raffleId: string;
  raffleTitle: string;
  totalPot: number;
  status: string;
  winnerTeam?: string | null;
}

type Entry = {
  id: string;
  user_id: string | null;
  assigned_team: string;
  created_at: string;
  display_name: string;
};

export function RaffleParticipantsModal({
  open,
  onOpenChange,
  raffleId,
  raffleTitle,
  totalPot,
  status,
  winnerTeam,
}: RaffleParticipantsModalProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('raffle_entries')
        .select('id, user_id, assigned_team, created_at')
        .eq('raffle_id', raffleId)
        .order('created_at', { ascending: true });

      if (error || !rows) {
        if (!cancelled) {
          setEntries([]);
          setLoading(false);
        }
        return;
      }

      const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean) as string[]));
      const nameMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        profiles?.forEach(p => nameMap.set(p.user_id, p.display_name || 'Anonymous'));
      }

      if (!cancelled) {
        setEntries(
          rows.map(r => ({
            ...r,
            display_name: r.user_id ? (nameMap.get(r.user_id) || 'Anonymous') : 'Anonymous',
          })),
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, raffleId]);

  // Group entries by user
  const grouped = entries.reduce<Record<string, { name: string; teams: string[] }>>((acc, e) => {
    const key = e.user_id || `anon-${e.id}`;
    if (!acc[key]) acc[key] = { name: e.display_name, teams: [] };
    acc[key].teams.push(e.assigned_team);
    return acc;
  }, {});
  const participants = Object.values(grouped);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{raffleTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              {status === 'resolved' ? 'Resolved' : 'Sold Out'}
            </Badge>
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {entries.length} teams · {participants.length} ticket holders
            </span>
            <span className="ml-auto font-mono font-semibold text-primary">
              {totalPot.toLocaleString()} XEC
            </span>
          </div>

          {status === 'resolved' && winnerTeam && (
            <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg p-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs text-muted-foreground">Winning Team</div>
                <div className="font-semibold text-foreground">{winnerTeam}</div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : participants.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No entries found.</p>
          ) : (
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1.5"
                >
                  <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.teams.map((t, ti) => {
                      const isWinner = status === 'resolved' && winnerTeam === t;
                      return (
                        <Badge
                          key={ti}
                          variant="outline"
                          className={
                            isWinner
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-background/40'
                          }
                        >
                          {isWinner && <Trophy className="w-3 h-3 mr-1" />}
                          {t}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
