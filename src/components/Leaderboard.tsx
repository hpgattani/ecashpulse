import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Award, TrendingUp, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  user_id: string;
  ecash_address: string;
  total_wins: number;
  total_bets: number;
  total_winnings: number;
  win_rate: number;
}

const formatAddress = (address: string) => {
  if (!address) return 'Unknown';
  const clean = address.replace('ecash:', '');
  if (clean.length <= 12) return `ecash:${clean}`;
  return `ecash:${clean.slice(0, 6)}...${clean.slice(-6)}`;
};

export const Leaderboard = () => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Fetch bets with user info to calculate real stats
      const { data: betsData, error } = await supabase
        .from('bets')
        .select(`
          id,
          user_id,
          status,
          amount,
          payout_amount,
          users!inner(ecash_address)
        `)
        .in('status', ['confirmed', 'won', 'lost']);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        setLoading(false);
        return;
      }

      // Aggregate stats by user
      const userStats: Record<string, {
        ecash_address: string;
        total_bets: number;
        total_wins: number;
        total_winnings: number;
      }> = {};

      for (const bet of betsData || []) {
        const userId = bet.user_id;
        const address = (bet.users as any)?.ecash_address || '';

        if (!userStats[userId]) {
          userStats[userId] = {
            ecash_address: address,
            total_bets: 0,
            total_wins: 0,
            total_winnings: 0,
          };
        }

        userStats[userId].total_bets += 1;
        if (bet.status === 'won') {
          userStats[userId].total_wins += 1;
          userStats[userId].total_winnings += bet.payout_amount || 0;
        }
      }

      // Convert to array and calculate win rate
      const leaderboardData: LeaderboardEntry[] = Object.entries(userStats)
        .map(([user_id, stats]) => ({
          user_id,
          ecash_address: stats.ecash_address,
          total_bets: stats.total_bets,
          total_wins: stats.total_wins,
          total_winnings: stats.total_winnings,
          win_rate: stats.total_bets > 0 
            ? Math.round((stats.total_wins / stats.total_bets) * 100) 
            : 0
        }))
        .filter(l => l.total_bets > 0)
        .sort((a, b) => {
          // Sort by wins first, then by bets
          if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
          return b.total_bets - a.total_bets;
        })
        .slice(0, 10);

      setLeaders(leaderboardData);
    } catch (err) {
      console.error('Leaderboard error:', err);
    }
    setLoading(false);
  };

  const formatXEC = (satoshis: number) => {
    const xec = satoshis / 100;
    return xec.toLocaleString() + ' XEC';
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (index === 1) return <Medal className="w-6 h-6 text-gray-300" />;
    if (index === 2) return <Award className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-muted-foreground font-bold">{index + 1}</span>;
  };

  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/30';
    if (index === 1) return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30';
    if (index === 2) return 'bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/30';
    return 'bg-card/50 border-border/50';
  };

  if (loading) {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Top Predictors</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Leaderboard</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            The most active predictors on the platform
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-3">
          {leaders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No active predictors yet. Be the first!</p>
            </div>
          ) : leaders.map((leader, index) => (
            <motion.div
              key={leader.user_id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`rounded-xl border p-4 backdrop-blur-sm ${getRankBg(index)}`}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {getRankIcon(index)}
                </div>
                
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-mono font-semibold text-sm truncate">
                    {formatAddress(leader.ecash_address)}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{leader.total_bets} bets</span>
                    <span>{leader.total_wins} wins</span>
                  </div>
                </div>
                
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-lg font-bold text-primary">
                    <TrendingUp className="w-4 h-4" />
                    {leader.win_rate}%
                  </div>
                  {leader.total_winnings > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {formatXEC(leader.total_winnings)}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
