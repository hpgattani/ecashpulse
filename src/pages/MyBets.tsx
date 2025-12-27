import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PredictionDetailModal from '@/components/PredictionDetailModal';
import CountdownTimer from '@/components/CountdownTimer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Outcome } from '@/hooks/usePredictions';

interface BetWithPrediction {
  id: string;
  position: 'yes' | 'no';
  amount: number;
  status: 'pending' | 'confirmed' | 'won' | 'lost' | 'refunded';
  tx_hash: string | null;
  payout_tx_hash: string | null;
  created_at: string;
  confirmed_at: string | null;
  payout_amount: number | null;
  prediction_id: string;
  prediction: {
    id: string;
    title: string;
    status: string;
    end_date: string;
    yes_pool: number;
    no_pool: number;
    description: string | null;
    category: string;
  };
}

interface FullPrediction {
  id: string;
  question: string;
  description: string;
  category: string;
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  isMultiOption?: boolean;
  outcomes?: Outcome[];
}

const MyBets = () => {
  const { user, sessionToken, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bets, setBets] = useState<BetWithPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrediction, setSelectedPrediction] = useState<FullPrediction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && sessionToken) {
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
  }, [user, sessionToken]);

  const fetchBets = async () => {
    if (!user || !sessionToken) return;

    try {
      // Use edge function with session token for authentication
      const { data, error } = await supabase.functions.invoke('get-user-bets', {
        body: { session_token: sessionToken }
      });

      if (error) {
        console.error('Error fetching bets:', error);
        return;
      }

      if (data?.bets) {
        setBets(data.bets as unknown as BetWithPrediction[]);
      }
    } catch (err) {
      console.error('Error fetching bets:', err);
    }
    setLoading(false);
  };

  const handleBetClick = async (bet: BetWithPrediction) => {
    // Fetch full prediction with outcomes
    const { data: prediction, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', bet.prediction_id)
      .single();

    if (error || !prediction) return;

    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('*')
      .eq('prediction_id', bet.prediction_id);

    const totalPool = prediction.yes_pool + prediction.no_pool;
    const yesOdds = totalPool > 0 ? Math.round((prediction.yes_pool / totalPool) * 100) : 50;
    const noOdds = totalPool > 0 ? Math.round((prediction.no_pool / totalPool) * 100) : 50;

    let mappedOutcomes: Outcome[] | undefined;

    const normalizedLabels = (outcomes || []).map((o) => o.label.toLowerCase().trim());
    const isStandardYesNo = (outcomes?.length ?? 0) === 2 && normalizedLabels.includes('yes') && normalizedLabels.includes('no');
    const isStandardUpDown = (outcomes?.length ?? 0) === 2 && normalizedLabels.includes('up') && normalizedLabels.includes('down');
    const isBinary = isStandardYesNo || isStandardUpDown;
    const isMultiOption = Boolean(outcomes && outcomes.length > 0 && (outcomes.length > 2 || !isBinary));

    if (isMultiOption) {
      const outcomeTotalPool = outcomes.reduce((sum, o) => sum + o.pool, 0);
      mappedOutcomes = outcomes.map(o => ({
        id: o.id,
        label: o.label,
        pool: o.pool,
        odds: outcomeTotalPool > 0 ? Math.round((o.pool / outcomeTotalPool) * 100) : Math.round(100 / outcomes.length)
      }));
    }

    const fullPrediction: FullPrediction = {
      id: prediction.id,
      question: prediction.title,
      description: prediction.description || '',
      category: prediction.category,
      yesOdds,
      noOdds,
      volume: totalPool,
      endDate: prediction.end_date,
      isMultiOption,
      outcomes: mappedOutcomes
    };

    setSelectedPrediction(fullPrediction);
    setIsModalOpen(true);
  };

  const formatXEC = (satoshis: number) => {
    const xec = satoshis / 100;
    return xec.toLocaleString() + ' XEC';
  };

  const formatDate = (dateStr: string) => {
    // Display in IST (Asia/Kolkata)
    return new Date(dateStr).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
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
        <main className="container mx-auto px-4 py-8 pt-24">
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
                  onClick={() => handleBetClick(bet)}
                  className="glass-card p-4 md:p-6 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-display font-semibold text-foreground mb-2 hover:text-primary transition-colors">
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
                        <CountdownTimer endDate={bet.prediction.end_date} />
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
                      <div className="flex gap-2 text-xs">
                        {bet.tx_hash && (
                          <a
                            href={`https://explorer.e.cash/tx/${bet.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Bet TX
                          </a>
                        )}
                        {bet.payout_tx_hash && (
                          <a
                            href={`https://explorer.e.cash/tx/${bet.payout_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Payout TX
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>

      {selectedPrediction && (
        <PredictionDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          prediction={selectedPrediction}
          onSelectOutcome={() => {}}
        />
      )}
    </>
  );
};

export default MyBets;