import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp, Wallet, Crown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserBetHistoryModal } from './UserBetHistoryModal';

interface LeaderboardEntry {
  user_id: string;
  ecash_address: string;
  display_name: string | null;
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
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Use edge function to bypass RLS restrictions on bets table
      const { data, error } = await supabase.functions.invoke('get-leaderboard');

      if (error) {
        console.error('Error fetching leaderboard:', error);
        setLoading(false);
        return;
      }

      if (data?.leaderboard) {
        setLeaders(data.leaderboard);
      }
    } catch (err) {
      console.error('Leaderboard error:', err);
    }
    setLoading(false);
  };

  const formatXEC = (satoshis: number) => {
    const xec = satoshis / 100;
    if (xec >= 1000000) {
      return (xec / 1000000).toFixed(2) + 'M XEC';
    }
    if (xec >= 1000) {
      return (xec / 1000).toFixed(1) + 'K XEC';
    }
    return xec.toLocaleString() + ' XEC';
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-6 h-6 text-yellow-400 drop-shadow-glow" />;
    if (index === 1) return <Trophy className="w-6 h-6 text-gray-300" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-muted-foreground font-bold">{index + 1}</span>;
  };

  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-500/30 via-amber-500/20 to-yellow-600/10 border-yellow-500/50 shadow-lg shadow-yellow-500/20';
    if (index === 1) return 'bg-gradient-to-r from-gray-400/25 to-gray-500/10 border-gray-400/40';
    if (index === 2) return 'bg-gradient-to-r from-amber-600/25 to-amber-700/10 border-amber-600/40';
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-400/30 via-white/20 to-gray-400/30 border border-gray-300/50 mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.2)] backdrop-blur-sm">
            <Crown className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium bg-gradient-to-b from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">{t.winnersCircle}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.topWinners}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t.leaderboardSubtitle}
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-3">
          {leaders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t.noWinnersYet}</p>
            </div>
          ) : leaders.map((leader, index) => (
            <motion.div
              key={leader.user_id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true }}
              onClick={() => setSelectedUser(leader)}
              className={`rounded-xl border p-4 backdrop-blur-sm transition-all hover:scale-[1.02] cursor-pointer group ${getRankBg(index)}`}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {getRankIcon(index)}
                </div>
                
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                    index === 0 
                      ? 'bg-gradient-to-br from-yellow-500/30 to-amber-600/30 border-yellow-500/50' 
                      : 'bg-primary/20 border-primary/30'
                  }`}>
                    <Wallet className={`w-6 h-6 ${index === 0 ? 'text-yellow-400' : 'text-primary'}`} />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {leader.display_name || formatAddress(leader.ecash_address)}
                  </h3>
                  {leader.display_name && (
                    <p className="font-mono text-xs text-muted-foreground truncate">
                      {formatAddress(leader.ecash_address)}
                    </p>
                  )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-green-500" />
                        <span className="text-green-500 font-medium">{leader.total_wins} {t.wins}</span>
                      </span>
                      <span>{leader.total_bets} {t.bets}</span>
                    </div>
                </div>
                
                <div className="flex-shrink-0 text-right flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-1 text-lg font-bold text-green-500">
                      <TrendingUp className="w-4 h-4" />
                      {leader.win_rate}%
                    </div>
                    {leader.total_winnings > 0 && (
                      <div className="text-sm font-semibold text-yellow-400">
                        💰 {formatXEC(leader.total_winnings)}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* User Bet History Modal */}
      <UserBetHistoryModal
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        userId={selectedUser?.user_id || ''}
        displayName={selectedUser?.display_name || null}
        ecashAddress={formatAddress(selectedUser?.ecash_address || '')}
      />
    </section>
  );
};