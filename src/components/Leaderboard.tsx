import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Award, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_wins: number;
  total_bets: number;
  total_winnings: number;
  win_rate: number;
}

export const Leaderboard = () => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        user_id,
        display_name,
        avatar_url,
        total_wins,
        total_bets,
        total_volume
      `)
      .order('total_wins', { ascending: false })
      .limit(10);

    if (!error && data) {
      const leaderboardData: LeaderboardEntry[] = data.map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        total_wins: p.total_wins || 0,
        total_bets: p.total_bets || 0,
        total_winnings: p.total_volume || 0,
        win_rate: p.total_bets && p.total_bets > 0 
          ? Math.round(((p.total_wins || 0) / p.total_bets) * 100) 
          : 0
      }));
      setLeaders(leaderboardData);
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

  if (leaders.length === 0 || leaders.every(l => l.total_bets === 0)) {
    return null;
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
            The most successful predictors on the platform
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-3">
          {leaders.filter(l => l.total_bets > 0).map((leader, index) => (
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
                  {leader.avatar_url ? (
                    <img 
                      src={leader.avatar_url} 
                      alt={leader.display_name || 'User'}
                      className="w-12 h-12 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {leader.display_name || 'Anonymous'}
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
                  <div className="text-sm text-muted-foreground">
                    {formatXEC(leader.total_winnings)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
