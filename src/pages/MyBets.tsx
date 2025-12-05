import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface BetWithPrediction {
  id: string;
  position: 'yes' | 'no';
  amount: number;
  status: 'pending' | 'confirmed' | 'won' | 'lost' | 'refunded';
  tx_hash: string | null;
  created_at: string;
  confirmed_at: string | null;
  payout_amount: number | null;
  prediction: {
    title: string;
    status: string;
    end_date: string;
    yes_pool: number;
    no_pool: number;
  };
}

const MyBets = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bets, setBets] = useState<BetWithPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchBets();
      // Subscribe to realtime updates
      const channel = supabase
        .channel('my-bets')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bets',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchBets();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchBets = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('bets')
      .select(`
        *,
        prediction:predictions(title, status, end_date, yes_pool, no_pool)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bets:', error);
    } else {
      setBets((data as unknown as BetWithPrediction[]) || []);
    }
    setLoading(false);
  };

  const formatXEC = (satoshis: number) => {
    const xec = satoshis / 100;
    return xec.toLocaleString() + ' XEC';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500/50"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="text-blue-500 border-blue-500/50"><CheckCircle2 className="w-3 h-3 mr-1" />Confirmed</Badge>;
      case 'won':
        return <Badge variant="outline" className="text-emerald-500 border-emerald-500/50"><TrendingUp className="w-3 h-3 mr-1" />Won</Badge>;
      case 'lost':
        return <Badge variant="outline" className="text-red-500 border-red-500/50"><TrendingDown className="w-3 h-3 mr-1" />Lost</Badge>;
      case 'refunded':
        return <Badge variant="outline" className="text-muted-foreground"><XCircle className="w-3 h-3 mr-1" />Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Bets - eCash Pulse</title>
        <meta name="description" content="View and track your bets on eCash Pulse prediction market." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Markets
            </Button>
            <h1 className="font-display text-3xl font-bold text-foreground">
              My Bets
            </h1>
            <p className="text-muted-foreground mt-2">
              Track all your predictions and winnings
            </p>
          </div>

          {bets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-12 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                No bets yet
              </h2>
              <p className="text-muted-foreground mb-6">
                Start trading on prediction markets to see your bets here
              </p>
              <Button onClick={() => navigate('/')}>
                Explore Markets
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {bets.map((bet, index) => (
                <motion.div
                  key={bet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card p-4 md:p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-display font-semibold text-foreground mb-2">
                        {bet.prediction?.title || 'Unknown Prediction'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge
                          variant={bet.position === 'yes' ? 'default' : 'destructive'}
                          className={bet.position === 'yes' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
                        >
                          {bet.position.toUpperCase()}
                        </Badge>
                        {getStatusBadge(bet.status)}
                        <span className="text-muted-foreground">
                          {formatDate(bet.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-lg text-foreground">
                        {formatXEC(bet.amount)}
                      </p>
                      {bet.payout_amount && (
                        <p className="text-sm text-emerald-400">
                          Won: {formatXEC(bet.payout_amount)}
                        </p>
                      )}
                      {bet.tx_hash && (
                        <a
                          href={`https://explorer.e.cash/tx/${bet.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View TX
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default MyBets;
