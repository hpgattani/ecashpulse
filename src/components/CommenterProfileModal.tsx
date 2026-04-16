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

interface BetRecord {
  status: string;
  amount: number;
  payout_amount: number | null;
  confirmed_at: string | null;
}

const CommenterProfileModal = ({ open, onOpenChange, userId, displayName, avatarUrl }: CommenterProfileModalProps) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ total_bets: number; total_wins: number; total_volume: number } | null>(null);
  const [bets, setBets] = useState<BetRecord[]>([]);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    const fetchData = async () => {
      const [profileRes, betsRes] = await Promise.all([
        supabase.from("profiles").select("total_bets, total_wins, total_volume").eq("user_id", userId).single(),
        supabase.from("bets").select("status, amount, payout_amount, confirmed_at").eq("user_id", userId).in("status", ["won", "lost"]).order("confirmed_at", { ascending: true }).limit(200),
      ]);
      setProfile(profileRes.data || { total_bets: 0, total_wins: 0, total_volume: 0 });
      setBets(betsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [open, userId]);

  const stats = useMemo(() => {
    const wins = bets.filter((b) => b.status === "won").length;
    const losses = bets.filter((b) => b.status === "lost").length;
    const totalProfit = bets.reduce((sum, b) => {
      if (b.status === "won") return sum + ((b.payout_amount || 0) - b.amount);
      if (b.status === "lost") return sum - b.amount;
      return sum;
    }, 0);
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    return { wins, losses, totalProfit, winRate };
  }, [bets]);

  // Build cumulative profit graph data
  const graphData = useMemo(() => {
    if (bets.length === 0) return [];
    let cumulative = 0;
    return bets.map((b) => {
      if (b.status === "won") cumulative += ((b.payout_amount || 0) - b.amount);
      else if (b.status === "lost") cumulative -= b.amount;
      return cumulative;
    });
  }, [bets]);

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
              <p className="text-xs text-muted-foreground font-normal">Betting Track Record</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
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
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <TrendingUp className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                <p className={`text-lg font-bold ${stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {stats.totalProfit >= 0 ? "+" : ""}{formatXec(stats.totalProfit)} XEC
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Profit</p>
              </div>
            </div>

            {/* Profit Graph */}
            {graphData.length > 1 && (
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Cumulative Profit</p>
                <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="w-full h-24" preserveAspectRatio="none">
                  {/* Zero line */}
                  <line
                    x1="0"
                    y1={graphHeight / 2}
                    x2={graphWidth}
                    y2={graphHeight / 2}
                    stroke="hsl(var(--border))"
                    strokeWidth="0.5"
                    strokeDasharray="4 2"
                  />
                  {/* Profit line */}
                  <polyline
                    fill="none"
                    stroke={stats.totalProfit >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={graphData
                      .map((val, i) => {
                        const x = (i / (graphData.length - 1)) * graphWidth;
                        const y = graphHeight / 2 - (val / maxVal) * (graphHeight / 2 - 4);
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                  {/* Area fill */}
                  <polygon
                    fill={stats.totalProfit >= 0 ? "hsl(var(--chart-2) / 0.1)" : "hsl(var(--destructive) / 0.1)"}
                    points={`0,${graphHeight / 2} ${graphData
                      .map((val, i) => {
                        const x = (i / (graphData.length - 1)) * graphWidth;
                        const y = graphHeight / 2 - (val / maxVal) * (graphHeight / 2 - 4);
                        return `${x},${y}`;
                      })
                      .join(" ")} ${graphWidth},${graphHeight / 2}`}
                  />
                </svg>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>First bet</span>
                  <span>Latest</span>
                </div>
              </div>
            )}

            {graphData.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <BarChart3 className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">No resolved bets yet</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommenterProfileModal;
