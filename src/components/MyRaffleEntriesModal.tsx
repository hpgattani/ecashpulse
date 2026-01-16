import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Ticket, Loader2, Trophy, Clock, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { formatDistanceToNow } from 'date-fns';

interface RaffleEntry {
  id: string;
  assigned_team: string;
  amount_paid: number;
  created_at: string;
  raffles: {
    id: string;
    title: string;
    event_name: string;
    status: string;
    winner_team: string | null;
    total_pot: number;
  };
}

interface MyRaffleEntriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyRaffleEntriesModal({ open, onOpenChange }: MyRaffleEntriesModalProps) {
  const { sessionToken } = useAuth();
  const { prices } = useCryptoPrices();
  const [entries, setEntries] = useState<RaffleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const xecPrice = prices.ecash || 0.0001;

  useEffect(() => {
    if (!open || !sessionToken) return;

    const fetchEntries = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-my-raffle-entries', {
          body: { session_token: sessionToken },
        });

        if (error) throw error;
        setEntries(data.entries || []);
      } catch (error) {
        console.error('Error fetching entries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [open, sessionToken]);

  const getStatusBadge = (status: string, winnerTeam: string | null, assignedTeam: string) => {
    if (status === 'resolved') {
      if (winnerTeam === assignedTeam) {
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">🏆 Winner!</Badge>;
      }
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Lost</Badge>;
    }
    if (status === 'full') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Awaiting Result</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Active</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            My Raffle Entries
          </DialogTitle>
          <DialogDescription>
            Your team assignments across all raffles
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center">
            <Ticket className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No raffle entries yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Join a raffle to get a random team assignment
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const isWinner = entry.raffles.status === 'resolved' && 
                               entry.raffles.winner_team === entry.assigned_team;
              const potUsd = (entry.raffles.total_pot * xecPrice).toFixed(2);

              return (
                <div
                  key={entry.id}
                  className={`glass-card p-4 space-y-3 ${isWinner ? 'ring-2 ring-emerald-500/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate">{entry.raffles.title}</h4>
                      <p className="text-xs text-muted-foreground">{entry.raffles.event_name}</p>
                    </div>
                    {getStatusBadge(entry.raffles.status, entry.raffles.winner_team, entry.assigned_team)}
                  </div>

                  <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      {isWinner ? (
                        <Trophy className="w-5 h-5 text-amber-400" />
                      ) : (
                        <Eye className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Your Team</p>
                      <p className="font-display font-bold text-foreground">{entry.assigned_team}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">Pot: </span>
                      <span className="font-mono font-medium text-foreground">
                        {entry.raffles.total_pot.toLocaleString()} XEC
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">(~${potUsd})</span>
                    </div>
                  </div>

                  {isWinner && (
                    <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-lg p-3 text-center">
                      <p className="text-sm font-medium text-emerald-400">
                        🎉 Congratulations! You won the pot!
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
