import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Trophy, TrendingUp, TrendingDown, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CommenterProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface UserStats {
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  profitCurve: number[];
}

const CommenterProfileModal = ({ open, onOpenChange, userId, displayName, avatarUrl }: CommenterProfileModalProps) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-user-stats", {
          body: { user_id: userId },
        });
        if (!error && data) {
          setStats(data);
        } else {
          setStats({ wins: 0, losses: 0, winRate: 0, totalProfit: 0, profitCurve: [] });
        }
      } catch {
        setStats({ wins: 0, losses: 0, winRate: 0, totalProfit: 0, profitCurve: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [open, userId]);

  const graphData = useMemo(() => (stats?.profitCurve || []).map((p: any) => typeof p === 'number' ? p : p.v), [stats]);
  const maxVal = Math.max(...graphData.map(Math.abs), 1);
  const graphHeight = 100;
  const graphWidth = 280;

  const formatXec = (sats: number) => {
    const xec = sats / 100;
    if (Math.abs(xec) >= 1000000) return `${(xec / 1000000).toFixed(1)}M`;
    if (Math.abs(xec) >= 1000) return `${(xec / 1000).toFixed(1)}K`;
    return xec.toFixed(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-3 text-foreground">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted border border-border/50 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold truncate">{displayName || "Anonymous"}</p>
              <p className="text-xs text-primary font-normal">⚡ Pulse Performance</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <div className="p-4 space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <Trophy className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                <p className="text-lg font-bold text-foreground">{stats.wins}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wins</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <TrendingDown className="w-4 h-4 mx-auto mb-1 text-red-400" />
                <p className="text-lg font-bold text-foreground">{stats.losses}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Losses</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <BarChart3 className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold text-foreground">{stats.winRate}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Rate</p>
              </div>
            </div>

            {/* Bullish Badge */}
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-2xl mb-1">🐂</p>
              <p className="text-xs text-muted-foreground font-medium">
                {stats.wins + stats.losses > 0
                  ? `${stats.wins + stats.losses} markets entered`
                  : "No bets yet — waiting to go bullish!"}
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default CommenterProfileModal;
