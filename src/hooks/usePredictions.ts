import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DBPrediction {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_url: string | null;
  end_date: string;
  status: string;
  yes_pool: number;
  no_pool: number;
  escrow_address: string;
  created_at: string;
}

interface DBOutcome {
  id: string;
  prediction_id: string;
  label: string;
  pool: number;
}

export interface Outcome {
  id: string;
  label: string;
  pool: number;
  odds: number;
}

export interface Prediction {
  id: string;
  question: string;
  description: string;
  category: 'crypto' | 'politics' | 'sports' | 'tech' | 'entertainment' | 'economics';
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  image?: string;
  trending?: boolean;
  escrowAddress: string;
  status: string;
  isMultiOption: boolean;
  outcomes: Outcome[];
}

const transformPrediction = (p: DBPrediction, outcomes: DBOutcome[]): Prediction => {
  const predictionOutcomes = outcomes.filter(o => o.prediction_id === p.id);
  const isMultiOption = predictionOutcomes.length > 0;
  
  let totalPool: number;
  let yesOdds: number;
  let noOdds: number;
  let transformedOutcomes: Outcome[] = [];
  
  if (isMultiOption) {
    totalPool = predictionOutcomes.reduce((sum, o) => sum + o.pool, 0);
    transformedOutcomes = predictionOutcomes.map(o => ({
      id: o.id,
      label: o.label,
      pool: o.pool,
      odds: totalPool > 0 ? Math.round((o.pool / totalPool) * 100) : Math.round(100 / predictionOutcomes.length)
    })).sort((a, b) => b.odds - a.odds);
    
    // For multi-option, yes/no odds are just for display compatibility
    yesOdds = transformedOutcomes[0]?.odds || 50;
    noOdds = 100 - yesOdds;
  } else {
    totalPool = p.yes_pool + p.no_pool;
    yesOdds = totalPool > 0 ? Math.round((p.yes_pool / totalPool) * 100) : 50;
    noOdds = totalPool > 0 ? 100 - yesOdds : 50;
  }
  
  // Convert satoshis to USD (rough estimate: 1 XEC ≈ $0.00003)
  const volumeUSD = (totalPool / 100) * 0.00003;

  return {
    id: p.id,
    question: p.title,
    description: p.description || '',
    category: p.category as Prediction['category'],
    yesOdds,
    noOdds,
    volume: volumeUSD,
    endDate: p.end_date,
    image: p.image_url || undefined,
    trending: totalPool > 100000,
    escrowAddress: p.escrow_address,
    status: p.status,
    isMultiOption,
    outcomes: transformedOutcomes,
  };
};

export const usePredictions = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictions();

    // Subscribe to realtime updates on predictions
    const predictionsChannel = supabase
      .channel('predictions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
        },
        () => {
          fetchPredictions();
        }
      )
      .subscribe();

    // Subscribe to outcomes for multi-option updates
    const outcomesChannel = supabase
      .channel('outcomes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'outcomes',
        },
        () => {
          fetchPredictions();
        }
      )
      .subscribe();

    // Subscribe to bets to update pools in real-time
    const betsChannel = supabase
      .channel('bets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
        },
        () => {
          fetchPredictions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(predictionsChannel);
      supabase.removeChannel(outcomesChannel);
      supabase.removeChannel(betsChannel);
    };
  }, []);

  const fetchPredictions = async () => {
    // Fetch predictions and outcomes in parallel
    const [predictionsResult, outcomesResult] = await Promise.all([
      supabase
        .from('predictions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('outcomes')
        .select('*')
    ]);

    if (predictionsResult.error) {
      setError(predictionsResult.error.message);
      console.error('Error fetching predictions:', predictionsResult.error);
    } else {
      const outcomes = (outcomesResult.data || []) as DBOutcome[];
      setPredictions(
        (predictionsResult.data as DBPrediction[]).map(p => transformPrediction(p, outcomes))
      );
    }
    setLoading(false);
  };

  return { predictions, loading, error, refetch: fetchPredictions };
};
