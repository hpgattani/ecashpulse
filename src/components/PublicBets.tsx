import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, TrendingUp, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface Bet {
  id: string;
  amount: number;
  position: 'yes' | 'no';
  status: string;
  tx_hash: string | null;
  created_at: string;
  confirmed_at: string | null;
  user_id: string;
  prediction_id: string;
  users: {
    ecash_address: string;
  } | null;
  predictions: {
    title: string;
  } | null;
}

const PublicBets = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBets();

    // Subscribe to realtime updates for new bets and updates
    const channel = supabase
      .channel('public-bets-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bets'
        },
        (payload) => {
          console.log('New bet detected:', payload);
          // Immediately fetch to get full bet data with joins
          fetchBets();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bets'
        },
        (payload) => {
          console.log('Bet updated:', payload);
          fetchBets();
        }
      )
      .subscribe((status) => {
        console.log('PublicBets realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBets = async () => {
    try {
      // Use edge function to bypass RLS for public visibility
      const { data, error } = await supabase.functions.invoke('get-public-bets');

      if (error) throw error;
      setBets((data?.bets as Bet[]) || []);
    } catch (error) {
      console.error('Error fetching bets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 20) return address;
    return `${address.slice(0, 12)}...${address.slice(-8)}`;
  };

  const formatAmount = (satoshis: number) => {
    return (satoshis / 100).toLocaleString() + ' XEC';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-muted-foreground">No bets yet. Be the first to bet!</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 sm:p-6">
      <h3 className="font-display font-bold text-base sm:text-lg text-foreground mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        Recent Bets (Transparent)
      </h3>
      
      <div className="space-y-2 sm:space-y-3 max-h-[350px] sm:max-h-[400px] overflow-y-auto">
        {bets.map((bet, index) => (
          <motion.div
            key={bet.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {bet.position === 'yes' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <span className={`font-semibold text-sm ${
                  bet.position === 'yes' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {bet.position.toUpperCase()}
                </span>
                <span className="text-foreground font-medium text-sm">
                  {formatAmount(bet.amount)}
                </span>
              </div>
              <Badge variant={bet.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs w-fit">
                {bet.status === 'confirmed' ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmed</>
                ) : (
                  <><Clock className="w-3 h-3 mr-1" /> Pending</>
                )}
              </Badge>
            </div>
            
            {bet.predictions?.title && (
              <p className="text-xs text-foreground/80 mb-2 line-clamp-1">
                {bet.predictions.title}
              </p>
            )}
            
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="truncate">Wallet: {bet.users ? formatAddress(bet.users.ecash_address) : 'Unknown'}</span>
                <span className="text-muted-foreground/70">{formatTime(bet.created_at)}</span>
              </div>
              
              {bet.tx_hash && (
                <a
                  href={`https://explorer.e.cash/tx/${bet.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline break-all"
                >
                  <span className="font-mono text-[10px] sm:text-xs">
                    TX: {bet.tx_hash.slice(0, 12)}...{bet.tx_hash.slice(-6)}
                  </span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PublicBets;
