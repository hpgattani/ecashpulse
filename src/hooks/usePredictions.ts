import { useCallback, useEffect, useRef, useState } from 'react';
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
  createdAt: string;
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
    q.includes('market cap') || q.includes('ecash') || q.includes('xec') ||
    q.includes('chainlink') || q.includes('link') || q.includes('polygon') || q.includes('matic') ||
    q.includes('avalanche') || q.includes('avax') || q.includes('polkadot') || q.includes('dot') ||
    q.includes('litecoin') || q.includes('ltc') || q.includes('uniswap') || q.includes('aave') ||
    q.includes('tether') || q.includes('usdt') || q.includes('usdc') || q.includes('stablecoin') ||
    q.includes('altcoin') || q.includes('memecoin') || q.includes('shiba') || q.includes('pepe') ||
    q.includes('floki') || q.includes('bnb') || q.includes('tron') || q.includes('trx') ||
    q.includes('near') || q.includes('sui') || q.includes('aptos') || q.includes('apt') ||
    q.includes('cosmos') || q.includes('atom') || q.includes('binance') || q.includes('coinbase') ||
    (q.includes('price') && (q.includes('$') || q.includes('usd')))
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
  
  // Determine if this is a multi-option prediction:
  // - More than 2 outcomes = definitely multi-option
  // - Exactly 2 outcomes that are binary pairs (Yes/No or Up/Down) = standard two-option prediction
  // - Any other configuration = multi-option
  const labels = predictionOutcomes.map(o => o.label.toLowerCase().trim());
  const isStandardYesNo = predictionOutcomes.length === 2 && 
    labels.includes('yes') && labels.includes('no');
  const isStandardUpDown = predictionOutcomes.length === 2 && 
    labels.includes('up') && labels.includes('down');
  const isBinaryPrediction = isStandardYesNo || isStandardUpDown;
  const isMultiOption = predictionOutcomes.length > 2 || 
    (predictionOutcomes.length > 0 && !isBinaryPrediction);
  
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
    createdAt: p.created_at,
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

  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchPredictions = useCallback(async () => {
    // Avoid stacking multiple concurrent fetches when many realtime events fire.
    if (inFlightRef.current) return inFlightRef.current;

    const task = (async () => {
      try {
        const [predictionsResult, outcomesResult] = await Promise.all([
          supabase
            .from('predictions')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false }),
          supabase.from('outcomes').select('*'),
        ]);

        if (predictionsResult.error) {
          setError(predictionsResult.error.message);
          console.error('Error fetching predictions:', predictionsResult.error);
          return;
        }

        if (outcomesResult.error) {
          setError(outcomesResult.error.message);
          console.error('Error fetching outcomes:', outcomesResult.error);
          return;
        }

        const outcomes = (outcomesResult.data || []) as DBOutcome[];
        setPredictions((predictionsResult.data as DBPrediction[]).map((p) => transformPrediction(p, outcomes)));
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to load markets');
        console.error('Error fetching markets:', err);
      } finally {
        setLoading(false);
      }
    })();

    inFlightRef.current = task.finally(() => {
      inFlightRef.current = null;
    }) as Promise<void>;

    return inFlightRef.current;
  }, []);

  useEffect(() => {
    fetchPredictions();

    // Realtime updates on predictions
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

    // Realtime updates for multi-option pools
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

    // Bets can update pools; refetch shortly after bet insert/update.
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
          setTimeout(() => fetchPredictions(), 800);
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
          setTimeout(() => fetchPredictions(), 800);
        }
      )
      .subscribe();

    // Hard fallback: polling so odds update even if realtime drops.
    const intervalId = window.setInterval(() => {
      fetchPredictions();
    }, 8000);

    const handleForceRefresh = () => fetchPredictions();
    window.addEventListener('predictions:refetch', handleForceRefresh);

    const handleFocus = () => fetchPredictions();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('predictions:refetch', handleForceRefresh);
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(predictionsChannel);
      supabase.removeChannel(outcomesChannel);
      supabase.removeChannel(betsChannel);
    };
  }, [fetchPredictions]);

  return { predictions, loading, error, refetch: fetchPredictions };
};
