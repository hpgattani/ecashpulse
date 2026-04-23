import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Crown, Trophy, Medal, TrendingUp, User, Flame, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { UserBetHistoryModal } from '@/components/UserBetHistoryModal';
import { toast } from '@/hooks/use-toast';

interface VolumeEntry {
  user_id: string;
  ecash_address: string;
  display_name: string | null;
  avatar_url: string | null;
  total_volume: number;
  total_bets: number;
}

const formatAddress = (address: string) => {
  if (!address) return 'Unknown';
  const clean = address.replace('ecash:', '');
  if (clean.length <= 12) return `ecash:${clean}`;
  return `ecash:${clean.slice(0, 6)}...${clean.slice(-6)}`;
};

const formatXEC = (sats: number) => {
  const xec = sats / 100;
  if (xec >= 1_000_000) return (xec / 1_000_000).toFixed(2) + 'M XEC';
  if (xec >= 1_000) return (xec / 1_000).toFixed(1) + 'K XEC';
  return xec.toLocaleString() + ' XEC';
};

const getRankIcon = (i: number) => {
  if (i === 0) return <Crown className="w-6 h-6 text-yellow-400" />;
  if (i === 1) return <Trophy className="w-6 h-6 text-gray-300" />;
  if (i === 2) return <Medal className="w-6 h-6 text-amber-600" />;
  return <span className="w-6 h-6 flex items-center justify-center text-muted-foreground font-bold">{i + 1}</span>;
};

const getRankBg = (i: number) => {
  if (i === 0) return 'bg-gradient-to-r from-yellow-500/30 via-amber-500/20 to-yellow-600/10 border-yellow-500/50 shadow-lg shadow-yellow-500/20';
  if (i === 1) return 'bg-gradient-to-r from-gray-400/25 to-gray-500/10 border-gray-400/40';
  if (i === 2) return 'bg-gradient-to-r from-amber-600/25 to-amber-700/10 border-amber-600/40';
  return 'bg-card/50 border-border/50';
};

const TopVolume = () => {
  const [leaders, setLeaders] = useState<VolumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VolumeEntry | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-top-volume');
        if (error) throw error;
        if (data?.leaderboard) setLeaders(data.leaderboard);
      } catch (e) {
        console.error('top volume error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Helmet>
        <title>Top Volume Traders | eCash Pulse</title>
        <meta name="description" content="The traders generating the most betting volume on eCash Pulse." />
      </Helmet>

      <div className="min-h-screen">
        <Header />
        <main className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-10"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/30 to-red-500/30 border border-orange-400/50 mb-4">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium">Volume Leaders</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Top Volume Traders</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Ranked by total XEC wagered across all confirmed bets. The most active traders on eCash Pulse.
              </p>
            </motion.div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leaders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Flame className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No volume data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaders.map((leader, index) => (
                  <motion.div
                    key={leader.user_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
                    onClick={() => setSelected(leader)}
                    className={`rounded-xl border p-4 backdrop-blur-sm transition-all hover:scale-[1.02] cursor-pointer ${getRankBg(index)}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">{getRankIcon(index)}</div>
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${index === 0 ? 'border-yellow-500/50' : 'border-primary/30'}`}>
                          {leader.avatar_url ? (
                            <img src={leader.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/20">
                              <User className="w-6 h-6 text-primary" />
                            </div>
                          )}
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
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {leader.total_bets} bets
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-1 text-lg font-bold text-orange-400">
                          <TrendingUp className="w-4 h-4" />
                          {formatXEC(leader.total_volume)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">total volume</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>

      <UserBetHistoryModal
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        userId={selected?.user_id || ''}
        displayName={selected?.display_name || null}
        ecashAddress={formatAddress(selected?.ecash_address || '')}
      />
    </>
  );
};

export default TopVolume;
