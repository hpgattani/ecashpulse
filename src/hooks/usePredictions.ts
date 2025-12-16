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

const detectCategory = (title: string, existingCategory: string): Prediction['category'] => {
  const q = title.toLowerCase();
  const existing = (existingCategory || '').toLowerCase();

  // Crypto keywords (check first as these are most specific)
  if (
    q.includes('bitcoin') || q.includes('btc') || q.includes('ethereum') || q.includes('eth') ||
    q.includes('solana') || q.includes('sol') || q.includes('xrp') || q.includes('ripple') ||
    q.includes('cardano') || q.includes('ada') || q.includes('dogecoin') || q.includes('doge') ||
    q.includes('crypto') || q.includes('token') || q.includes('defi') || q.includes('nft') ||
    q.includes('market cap') || q.includes('ecash') || q.includes('xec')
  ) {
    return 'crypto';
  }

  // Sports keywords
  if (
    q.includes('nfl') || q.includes('nba') || q.includes('nhl') || q.includes('mlb') ||
    q.includes('super bowl') || q.includes('world series') || q.includes('world cup') ||
    q.includes('championship') || q.includes('champions league') || q.includes('premier league') ||
    q.includes('wimbledon') || q.includes('tennis') || q.includes('football') || q.includes('soccer') ||
    q.includes('basketball') || q.includes('hockey') || q.includes('baseball') || q.includes('cricket') ||
    q.includes('ipl') || q.includes('olympics') || q.includes('ufc') || q.includes('boxing') ||
    q.includes('f1') || q.includes('formula 1') || q.includes('grand prix') ||
    q.includes('uefa') || q.includes('euro 20') || (q.includes('euro') && q.includes('final')) ||
    q.includes('final match') || q.includes('match be held')
  ) {
    return 'sports';
  }

  // Tech keywords (check before politics since tech companies often appear in political context)
  if (
    q.includes('apple') || q.includes('google') || q.includes('microsoft') || q.includes('amazon') ||
    q.includes('nvidia') || q.includes('openai') || q.includes('gpt') || q.includes(' ai') ||
    q.includes('artificial intelligence') || q.includes('chatgpt') || q.includes('deepmind') ||
    q.includes('tesla') || q.includes('spacex') || q.includes('iphone') || q.includes('android') ||
    q.includes('ar/vr') || q.includes('virtual reality') || q.includes('augmented reality') ||
    q.includes('robot') || q.includes('quantum') || q.includes('semiconductor') || q.includes('chip')
  ) {
    return 'tech';
  }

  // Entertainment keywords
  if (
    q.includes('oscar') || q.includes('oscars') || q.includes('academy award') ||
    q.includes('grammy') || q.includes('emmy') || q.includes('golden globe') ||
    q.includes('movie') || q.includes('film') || q.includes('director') || q.includes('best director') ||
    q.includes('episode') || q.includes('season') || q.includes('series') ||
    q.includes('released in theaters') || q.includes('theaters') || q.includes('cinema') ||
    q.includes('album') || q.includes('spotify') ||
    q.includes('netflix') || q.includes('disney') || q.includes('hbo') || q.includes('prime video') ||
    q.includes('celebrity') || q.includes('concert') || q.includes('tour') || q.includes('box office') ||
    q.includes('streaming') || q.includes('youtube') || q.includes('tiktok') ||
    (q.includes('elon musk') && q.includes('tweet')) ||
    q.includes('dune')
  ) {
    return 'entertainment';
  }

  // Economics keywords
  if (
    q.includes('fed') || q.includes('interest rate') || q.includes('inflation') || q.includes('gdp') ||
    q.includes('recession') || q.includes('stock market') || q.includes('s&p') || q.includes('dow') ||
    q.includes('nasdaq') || q.includes('unemployment') || q.includes('economy') || q.includes('fiscal')
  ) {
    return 'economics';
  }

  // If existing category is valid, keep it
  if (['crypto', 'politics', 'sports', 'tech', 'entertainment', 'economics'].includes(existing)) {
    return existing as Prediction['category'];
  }

  // Default to politics for elections, legislation, etc.
  return 'politics';
};

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
    category: detectCategory(p.title, p.category),
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
          event: 'INSERT',
          schema: 'public',
          table: 'bets',
        },
        () => {
          // Small delay to ensure DB trigger has updated the pool
          setTimeout(() => fetchPredictions(), 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bets',
        },
        () => {
          setTimeout(() => fetchPredictions(), 500);
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
