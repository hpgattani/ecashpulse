import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, RefreshCw, Wallet, User, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface UserBet {
  id: string;
  prediction_title: string;
  prediction_category: string;
  prediction_status: string;
  position: 'yes' | 'no';
  outcome_label: string | null;
  amount: number;
  status: string;
  payout_amount: number | null;
  created_at: string;
  confirmed_at: string | null;
}

interface UserBetHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  displayName: string | null;
  ecashAddress: string;
}

export const UserBetHistoryModal = ({
  open,
  onOpenChange,
  userId,
  displayName,
  ecashAddress,
}: UserBetHistoryModalProps) => {
  const [bets, setBets] = useState<UserBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profitStats, setProfitStats] = useState<{ wins: number; losses: number; winRate: number; totalProfit: number; profitCurve: { t: string; v: number }[] } | null>(null);
  const [graphPeriod, setGraphPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const { t } = useLanguage();
  const navigate = useNavigate();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  useEffect(() => {
    if (open && userId) {
      fetchBetHistory();
      fetchProfileAndStats();
    }
  }, [open, userId]);

  const fetchProfileAndStats = async () => {
    const [profileRes, statsRes] = await Promise.all([
      supabase.from('profiles').select('avatar_url').eq('user_id', userId).single(),
      supabase.functions.invoke('get-user-stats', { body: { user_id: userId } }),
    ]);
    setAvatarUrl(profileRes.data?.avatar_url || null);
    if (statsRes.data) setProfitStats(statsRes.data);
  };

  const fetchBetHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-user-bet-history', {
        body: { user_id: userId },
      });

      if (error) {
        console.error('Error fetching bet history:', error);
      } else if (data?.bets) {
        setBets(data.bets);
      }
    } catch (err) {
      console.error('Bet history error:', err);
    }
    setLoading(false);
  };

  const formatXEC = (satoshis: number) => {
    const xec = Math.abs(satoshis) / 100;
    const sign = satoshis < 0 ? '-' : '';
    if (xec >= 1_000_000) return sign + (xec / 1_000_000).toFixed(2) + 'M';
    if (xec >= 1_000) return sign + (xec / 1_000).toFixed(1) + 'K';
    return sign + xec.toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'lost':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'refunded':
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'text-green-500 bg-green-500/10';
      case 'lost':
        return 'text-red-500 bg-red-500/10';
      case 'refunded':
        return 'text-blue-500 bg-blue-500/10';
      default:
        return 'text-yellow-500 bg-yellow-500/10';
    }
  };

  const handleBetClick = (bet: UserBet) => {
    onOpenChange(false);
    // Extract prediction ID from the bet (we need to add it to the query)
    // For now navigate to home since we don't have prediction_id in the response
  };

  const stats = {
    total: bets.length,
    wins: bets.filter(b => b.status === 'won').length,
    losses: bets.filter(b => b.status === 'lost').length,
    pending: bets.filter(b => b.status === 'confirmed').length,
    totalVolume: bets.reduce((sum, b) => sum + b.amount, 0),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted border border-border/50 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold">
                {displayName || ecashAddress}
              </div>
              {displayName && (
                <div className="text-xs font-mono text-muted-foreground">
                  {ecashAddress}
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-1 py-3 border-b border-border">
          <div className="text-center">
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">{t.bets}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-500">{stats.wins}</div>
            <div className="text-[10px] text-muted-foreground">{t.wins}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-500">{stats.losses}</div>
            <div className="text-[10px] text-muted-foreground">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-[10px] text-muted-foreground">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">{formatXEC(stats.totalVolume)}</div>
            <div className="text-[10px] text-muted-foreground">Volume</div>
          </div>
        </div>

        {/* Net Profit + Graph */}
        {profitStats && (
          <div className="space-y-2 pb-2 border-b border-border">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground font-medium">⚡ Net Profit</span>
              <span className={`text-sm font-bold ${profitStats.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {profitStats.totalProfit >= 0 ? '+' : ''}{formatXEC(profitStats.totalProfit)} XEC
              </span>
            </div>
            {profitStats.profitCurve.length > 1 && (() => {
              const gd = profitStats.profitCurve;
              const maxV = Math.max(...gd.map(Math.abs), 1);
              const gW = 280, gH = 80;
              return (
                <div className="rounded-lg bg-muted/30 p-2">
                  <svg viewBox={`0 0 ${gW} ${gH}`} className="w-full h-16" preserveAspectRatio="none">
                    <line x1="0" y1={gH/2} x2={gW} y2={gH/2} stroke="#555" strokeWidth="0.5" strokeDasharray="4 2" />
                    <polygon
                      fill={profitStats.totalProfit >= 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"}
                      points={`0,${gH/2} ${gd.map((v,i) => `${(i/(gd.length-1))*gW},${gH/2-(v/maxV)*(gH/2-4)}`).join(' ')} ${gW},${gH/2}`}
                    />
                    <polyline
                      fill="none"
                      stroke={profitStats.totalProfit >= 0 ? "#34d399" : "#f87171"}
                      strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                      points={gd.map((v,i) => `${(i/(gd.length-1))*gW},${gH/2-(v/maxV)*(gH/2-4)}`).join(' ')}
                    />
                  </svg>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>First bet</span>
                    <span>Latest</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Bet List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No bet history found</p>
            </div>
          ) : (
            bets.map((bet) => (
              <div
                key={bet.id}
                className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate mb-1">
                      {bet.prediction_title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`px-1.5 py-0.5 rounded ${
                        bet.position === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {bet.outcome_label || bet.position.toUpperCase()}
                      </span>
                      <span>{formatXEC(bet.amount)} XEC</span>
                      <span>•</span>
                      <span>{formatDate(bet.confirmed_at || bet.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bet.status)}`}>
                      {getStatusIcon(bet.status)}
                      {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                    </span>
                    {bet.status === 'won' && bet.payout_amount && (
                      <span className="text-green-500 font-semibold text-sm">
                        +{formatXEC(bet.payout_amount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
