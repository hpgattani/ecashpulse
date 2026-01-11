import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Loader2, Hourglass } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import PredictionCard from './PredictionCard';
import SportsScoreBadge from './SportsScoreBadge';
import { Outcome } from '@/hooks/usePredictions';

interface PredictionRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  end_date: string;
  yes_pool: number;
  no_pool: number;
  escrow_address: string;
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

const AwaitingResolutionSection = () => {
  const { t } = useLanguage();
  const [predictions, setPredictions] = useState<PredictionForCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState<boolean | null>(null); // null = unknown, true/false = determined

  useEffect(() => {
    fetchAwaitingResolution();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('awaiting-resolution')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
        },
        () => {
          fetchAwaitingResolution();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAwaitingResolution = async () => {
    try {
      // Fetch active predictions where end_date has passed
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('predictions')
        .select('id, title, description, category, status, end_date, yes_pool, no_pool, escrow_address')
        .eq('status', 'active')
        .lt('end_date', now)
        .order('end_date', { ascending: false })
        .limit(6);

      if (error) {
        console.error('Error fetching awaiting resolution:', error);
        setLoading(false);
        return;
      }

      const predictionRows = (data || []) as PredictionRow[];
      
      // Fetch outcomes for all predictions
      const predictionIds = predictionRows.map(p => p.id);
      const { data: allOutcomes } = await supabase
        .from('outcomes')
        .select('*')
        .in('prediction_id', predictionIds);

      const outcomesByPrediction: Record<string, typeof allOutcomes> = {};
      for (const outcome of allOutcomes || []) {
        if (!outcomesByPrediction[outcome.prediction_id]) {
          outcomesByPrediction[outcome.prediction_id] = [];
        }
        outcomesByPrediction[outcome.prediction_id].push(outcome);
      }

      // Convert to card format
      const cards: PredictionForCard[] = predictionRows.map(pred => {
        const totalPool = pred.yes_pool + pred.no_pool;
        const yesOdds = totalPool > 0 ? Math.round((pred.yes_pool / totalPool) * 100) : 50;
        const noOdds = totalPool > 0 ? Math.round((pred.no_pool / totalPool) * 100) : 50;

        const outcomes = outcomesByPrediction[pred.id] || [];
        const normalizedLabels = outcomes.map((o) => o.label.toLowerCase().trim());
        const isStandardYesNo = outcomes.length === 2 && normalizedLabels.includes('yes') && normalizedLabels.includes('no');
        const isStandardUpDown = outcomes.length === 2 && normalizedLabels.includes('up') && normalizedLabels.includes('down');
        const isBinary = isStandardYesNo || isStandardUpDown;
        const isMultiOption = Boolean(outcomes.length > 0 && (outcomes.length > 2 || !isBinary));

        let mappedOutcomes: Outcome[] | undefined;
        if (isMultiOption) {
          const outcomeTotalPool = outcomes.reduce((sum, o) => sum + o.pool, 0);
          mappedOutcomes = outcomes.map(o => ({
            id: o.id,
            label: o.label,
            pool: o.pool,
            odds: outcomeTotalPool > 0 ? Math.round((o.pool / outcomeTotalPool) * 100) : Math.round(100 / outcomes.length)
          }));
        }

        return {
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
        };
      });

      setPredictions(cards);
      setHasData(cards.length > 0);
    } catch (err) {
      console.error('Error fetching awaiting resolution:', err);
      setHasData(false);
    }
    setLoading(false);
  };

  // Don't render if we've determined there's no data
  if (hasData === false) {
    return null;
  }

  // Don't render anything while initial loading - prevents flash
  if (hasData === null && loading) {
    return null;
  }

  return (
    <section id="awaiting" className="py-8 sm:py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-orange-500/20">
              <Hourglass className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              {t.awaitingResolution || "Awaiting Resolution"}
            </h2>
            {predictions.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-500 text-sm font-medium">
                {predictions.length}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            {t.awaitingResolutionDesc || "Betting has closed on these markets. Results will be determined by our oracle system."}
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-muted/50" />
                    <div className="h-4 w-16 bg-muted/50 rounded" />
                  </div>
                  <div className="h-5 w-full bg-muted/50 rounded mb-2" />
                  <div className="h-5 w-3/4 bg-muted/50 rounded mb-4" />
                  <div className="h-3 w-full bg-muted/30 rounded mb-4" />
                  <div className="flex gap-2">
                    <div className="h-10 flex-1 bg-muted/40 rounded-xl" />
                    <div className="h-10 flex-1 bg-muted/40 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {predictions.map((prediction, index) => (
              <div key={prediction.id} className="relative">
                {/* Orange awaiting indicator border */}
                <div className="absolute inset-0 rounded-2xl border-2 border-orange-500/40 pointer-events-none z-10" />
                {/* Awaiting badge */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/90 text-white text-xs font-medium shadow-lg">
                  <Hourglass className="w-3 h-3" />
                  {t.awaitingLabel || "Awaiting"}
                </div>
                {/* Sports Score Badge */}
                {prediction.category === 'sports' && (
                  <div className="absolute top-3 right-12 z-20">
                    <SportsScoreBadge title={prediction.question} category={prediction.category} />
                  </div>
                )}
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

export default AwaitingResolutionSection;
