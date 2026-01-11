import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import PredictionCard from './PredictionCard';
import { Outcome } from '@/hooks/usePredictions';

interface PendingBet {
  id: string;
  prediction_id: string;
  amount: number;
  position: string;
  status: string;
  created_at: string;
  prediction: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    status: string;
    end_date: string;
    yes_pool: number;
    no_pool: number;
    escrow_address: string;
  };
}

interface PredictionForCard {
  id: string;
  question: string;
  description: string;
  category: "crypto" | "politics" | "sports" | "tech" | "entertainment" | "economics" | "elections" | "finance" | "geopolitics" | "earnings" | "world" | "climate";
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  escrowAddress: string;
  isMultiOption?: boolean;
  outcomes?: Outcome[];
  yesPool?: number;
  noPool?: number;
}

const PendingBetsSection = () => {
  const { user, sessionToken } = useAuth();
  const { t } = useLanguage();
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [predictions, setPredictions] = useState<PredictionForCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !sessionToken) {
      setPendingBets([]);
      setPredictions([]);
      setLoading(false);
      return;
    }

    fetchPendingBets();

    // Subscribe to realtime updates for user's bets
    const channel = supabase
      .channel('pending-bets-section')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchPendingBets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, sessionToken]);

  const fetchPendingBets = async () => {
    if (!sessionToken) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-user-bets', {
        body: { session_token: sessionToken }
      });

      if (error) {
        console.error('Error fetching pending bets:', error);
        setLoading(false);
        return;
      }

      const bets = (data?.bets || []) as PendingBet[];
      const pending = bets.filter(b => b.status === 'pending');
      setPendingBets(pending);

      // Convert to prediction cards format
      const uniquePredictions = new Map<string, PredictionForCard>();
      
      for (const bet of pending) {
        if (!bet.prediction || uniquePredictions.has(bet.prediction_id)) continue;
        
        const pred = bet.prediction;
        const totalPool = pred.yes_pool + pred.no_pool;
        const yesOdds = totalPool > 0 ? Math.round((pred.yes_pool / totalPool) * 100) : 50;
        const noOdds = totalPool > 0 ? Math.round((pred.no_pool / totalPool) * 100) : 50;

        // Fetch outcomes for multi-option predictions
        const { data: outcomes } = await supabase
          .from('outcomes')
          .select('*')
          .eq('prediction_id', pred.id);

        const normalizedLabels = (outcomes || []).map((o) => o.label.toLowerCase().trim());
        const isStandardYesNo = (outcomes?.length ?? 0) === 2 && normalizedLabels.includes('yes') && normalizedLabels.includes('no');
        const isStandardUpDown = (outcomes?.length ?? 0) === 2 && normalizedLabels.includes('up') && normalizedLabels.includes('down');
        const isBinary = isStandardYesNo || isStandardUpDown;
        const isMultiOption = Boolean(outcomes && outcomes.length > 0 && (outcomes.length > 2 || !isBinary));

        let mappedOutcomes: Outcome[] | undefined;
        if (isMultiOption && outcomes) {
          const outcomeTotalPool = outcomes.reduce((sum, o) => sum + o.pool, 0);
          mappedOutcomes = outcomes.map(o => ({
            id: o.id,
            label: o.label,
            pool: o.pool,
            odds: outcomeTotalPool > 0 ? Math.round((o.pool / outcomeTotalPool) * 100) : Math.round(100 / outcomes.length)
          }));
        }

        uniquePredictions.set(bet.prediction_id, {
          id: pred.id,
          question: pred.title,
          description: pred.description || '',
          category: pred.category as PredictionForCard['category'],
          yesOdds,
          noOdds,
          volume: totalPool / 100,
          endDate: pred.end_date,
          escrowAddress: pred.escrow_address,
          isMultiOption,
          outcomes: mappedOutcomes,
          yesPool: pred.yes_pool,
          noPool: pred.no_pool,
        });
      }

      setPredictions(Array.from(uniquePredictions.values()));
    } catch (err) {
      console.error('Error fetching pending bets:', err);
    }
    setLoading(false);
  };

  // Don't render if user is not logged in or no pending bets
  if (!user || (!loading && predictions.length === 0)) {
    return null;
  }

  return (
    <section className="py-8 sm:py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-yellow-500/20">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              {t.pending} {t.bets}
            </h2>
            {pendingBets.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-500 text-sm font-medium">
                {pendingBets.length}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            {t.pendingBetsInfo}
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {predictions.map((prediction, index) => (
              <div key={prediction.id} className="relative">
                {/* Yellow pending indicator border */}
                <div className="absolute inset-0 rounded-2xl border-2 border-yellow-500/40 pointer-events-none z-10" />
                <PredictionCard
                  prediction={prediction}
                  index={index}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default PendingBetsSection;
