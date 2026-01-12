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
  category: 'crypto' | 'politics' | 'sports' | 'tech' | 'entertainment' | 'economics' | 'elections' | 'finance' | 'geopolitics' | 'earnings' | 'world' | 'climate';
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
  // Raw pool values in satoshis for accurate payout calculation
  yesPool: number;
  noPool: number;
}

const detectCategory = (title: string, existingCategory: string): Prediction['category'] => {
  const q = title.toLowerCase();
  const existing = (existingCategory || '').toLowerCase();
  
  // TRUST the existing database category if it's valid (not 'crypto' default or empty)
  const validCategories = ['crypto', 'politics', 'sports', 'tech', 'entertainment', 'economics', 'elections', 'finance', 'geopolitics', 'earnings', 'world', 'climate'];
  if (existing && validCategories.includes(existing) && existing !== 'crypto') {
    return existing as Prediction['category'];
  }
  
  // Only run detection if existing category is 'crypto' (the default) or invalid
  // Sports keywords - CHECK EARLY for Africa Cup, sports events
  if (
    q.includes('africa cup') || q.includes('afcon') || 
    q.includes('nfl') || q.includes('nba') || q.includes('nhl') || q.includes('mlb') ||
    q.includes('super bowl') || q.includes('world series') || q.includes('world cup') ||
    q.includes('championship') || q.includes('champions league') || q.includes('premier league') ||
    q.includes('wimbledon') || q.includes('tennis') || q.includes('football') || q.includes('soccer') ||
    q.includes('basketball') || q.includes('hockey') || q.includes('baseball') || q.includes('cricket') ||
    q.includes('ipl') || q.includes('olympics') || q.includes('ufc') || q.includes('boxing') ||
    q.includes('f1') || q.includes('formula 1') || q.includes('grand prix') || q.includes('grand slam') ||
    q.includes('uefa') || q.includes('euro 20') || (q.includes('euro') && q.includes('final')) ||
    q.includes('final match') || q.includes('match be held') || q.includes('nations')
  ) {
    return 'sports';
  }
  
  // World keywords - for UN/international affairs

  // Geopolitics keywords - CHECK EARLY to prevent misclassification
  if (
    q.includes('war') || q.includes('conflict') || q.includes('russia') || q.includes('ukraine') ||
    q.includes('nato') || q.includes('sanctions') || q.includes('diplomacy') ||
    q.includes('military') || q.includes('troops') || q.includes('invasion') || q.includes('peace deal') ||
    q.includes('iran') || q.includes('north korea') || q.includes('middle east') || q.includes('israel') ||
    q.includes('gaza') || q.includes('hamas') || q.includes('hezbollah') || q.includes('taiwan') ||
    q.includes('china invade') || q.includes('regime') || q.includes('nuclear weapon') ||
    q.includes('iraqi') || q.includes('syrian') || q.includes('afghan')
  ) {
    return 'geopolitics';
  }

  // Entertainment keywords - CHECK BEFORE crypto for K-pop, Grammy, Netflix, YouTube, etc.
  if (
    q.includes('k-pop') || q.includes('kpop') || q.includes('bts') || q.includes('blackpink') ||
    q.includes('grammy') || q.includes('emmy') || q.includes('golden globe') ||
    q.includes('oscar') || q.includes('oscars') || q.includes('academy award') ||
    q.includes('movie') || q.includes('film') || q.includes('director') || q.includes('best director') ||
    q.includes('netflix') || q.includes('disney') || q.includes('hbo') || q.includes('prime video') ||
    q.includes('youtube') || q.includes('tiktok') || q.includes('instagram') || q.includes('subscriber') ||
    q.includes('taylor swift') || q.includes('beyonce') || q.includes('drake') || q.includes('kanye') ||
    q.includes('marvel') || q.includes('dc comics') || q.includes('box office') ||
    q.includes('mrbeast') || q.includes('podcast') || q.includes('influencer') ||
    q.includes('met gala') || q.includes('vogue') || q.includes('fashion') ||
    q.includes('celebrity') || q.includes('concert') || q.includes('tour') || q.includes('album') ||
    q.includes('streaming') || q.includes('kardashian') || q.includes('joe rogan') ||
    q.includes('viral') || q.includes('views') || q.includes('followers')
  ) {
    return 'entertainment';
  }

  // Climate & Science keywords - CHECK BEFORE crypto for temperature/science predictions
  if (
    q.includes('climate') || q.includes('carbon') || q.includes('emissions') || q.includes('global warming') ||
    q.includes('renewable') || q.includes('solar power') || q.includes('wind power') ||
    q.includes('paris agreement') || q.includes('cop2') ||
    q.includes('nasa') || q.includes('mars') || q.includes('moon landing') || q.includes('asteroid') ||
    q.includes('vaccine') || q.includes('fda') || q.includes('drug approval') || q.includes('clinical trial') ||
    q.includes('temperature') || q.includes('°c') || q.includes('°f') || q.includes('celsius') ||
    q.includes('fahrenheit') || q.includes('weather') || q.includes('hurricane') || q.includes('typhoon') ||
    q.includes('heatwave') || q.includes('heat wave') || q.includes('drought') || q.includes('flood') ||
    q.includes('hottest year') || q.includes('coldest') || q.includes('record high') || q.includes('record low') ||
    q.includes('arctic') || q.includes('sea ice') || q.includes('co2') || q.includes('water on mars')
  ) {
    return 'climate';
  }

  // Finance keywords - bank failures, central banks, CBDC (NOT crypto exchanges)
  if (
    q.includes('bank failure') || q.includes('bank fail') || q.includes('banking crisis') ||
    q.includes('central bank') || q.includes('federal reserve') || q.includes('bank of england') ||
    q.includes('ecb') || q.includes('digital euro') || q.includes('cbdc') ||
    q.includes('forex') || q.includes('wall street') || q.includes('hedge fund') ||
    q.includes('treasury') || q.includes('bond market')
  ) {
    return 'finance';
  }

  // Crypto keywords - MUST contain actual crypto terms
  if (
    q.includes('bitcoin') || q.includes('btc') || q.includes('ethereum') || q.includes('eth ') ||
    q.includes('solana') || q.includes('xrp') || q.includes('ripple') ||
    q.includes('cardano') || q.includes('ada ') || q.includes('dogecoin') || q.includes('doge') ||
    q.includes('cryptocurrency') || q.includes('defi') || q.includes('nft') ||
    q.includes('ecash') || q.includes('xec') || q.includes('zcash') || q.includes('monero') ||
    q.includes('kaspa') || q.includes('hedera') || q.includes('algorand') ||
    q.includes('chainlink') || q.includes('polygon') || q.includes('matic') ||
    q.includes('avalanche') || q.includes('avax') || q.includes('polkadot') ||
    q.includes('litecoin') || q.includes('ltc') || q.includes('uniswap') || q.includes('aave') ||
    q.includes('stablecoin') || q.includes('memecoin') || q.includes('shiba') || q.includes('pepe coin') ||
    q.includes('binance') || q.includes('coinbase') || q.includes('crypto exchange')
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
    q.includes('f1') || q.includes('formula 1') || q.includes('grand prix') || q.includes('grand slam') ||
    q.includes('uefa') || q.includes('euro 20') || (q.includes('euro') && q.includes('final')) ||
    q.includes('final match') || q.includes('match be held') ||
    q.includes('djokovic') || q.includes('federer') || q.includes('nadal') || q.includes('alcaraz') ||
    q.includes('sinner') || q.includes('french open') || q.includes('us open') || q.includes('australian open')
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

  // Finance keywords (banking, stock trading, forex) - NOT crypto!
  // Must NOT match crypto keywords, so check for absence of crypto terms
  const hasCryptoKeywords = q.includes('bitcoin') || q.includes('btc') || q.includes('ethereum') || 
    q.includes('crypto') || q.includes('token') || q.includes('defi');
  if (
    !hasCryptoKeywords && (
      q.includes('bank') || q.includes('forex') || q.includes('currency') || 
      q.includes('wall street') || q.includes('hedge fund') || q.includes('investment') || 
      q.includes('bond') || q.includes('treasury') || q.includes('interest rate') ||
      q.includes('uk economy') || q.includes('us economy') || q.includes('federal reserve') ||
      q.includes('bank of england') || q.includes('ecb') || q.includes('central bank')
    )
  ) {
    return 'finance';
  }

  // Politics keywords (UK/US specific political events, not geopolitics)
  if (
    q.includes('labour') || q.includes('tory') || q.includes('conservative party') || 
    q.includes('starmer') || q.includes('sunak') || q.includes('uk government') ||
    q.includes('democrat') || q.includes('republican') || q.includes('biden') || q.includes('trump') ||
    q.includes('white house') || q.includes('downing street') || q.includes('westminster') ||
    q.includes('impeach') || q.includes('cabinet') || q.includes('secretary of')
  ) {
    return 'politics';
  }

  // Geopolitics - already checked above, skip duplicate
  // Earnings keywords (corporate earnings reports)
  if (
    q.includes('earnings') || q.includes('quarterly report') || q.includes('revenue beat') ||
    q.includes('eps') || q.includes('guidance') || q.includes('profit margin') || q.includes('q1') ||
    q.includes('q2') || q.includes('q3') || q.includes('q4') || q.includes('fiscal year')
  ) {
    return 'earnings';
  }

  // Economics keywords (check for company/market valuations)
  if (
    q.includes('fed') || q.includes('interest rate') || q.includes('inflation') || q.includes('gdp') ||
    q.includes('recession') || q.includes('stock market') || q.includes('s&p') || q.includes('dow') ||
    q.includes('nasdaq') || q.includes('unemployment') || q.includes('economy') || q.includes('fiscal') ||
    q.includes('largest company') || q.includes('market value') || q.includes('valuation') ||
    q.includes('trillion') || q.includes('billion') || q.includes('stock price') || q.includes('ipo') ||
    q.includes('revenue') || q.includes('profit') || q.includes('market share') ||
    q.includes('company worth') || q.includes('most valuable')
  ) {
    return 'economics';
  }

  // Additional entertainment keywords (fallback for any missed culture/entertainment content)
  if (
    q.includes('episode') || q.includes('season') || q.includes('series') ||
    q.includes('released in theaters') || q.includes('theaters') || q.includes('cinema') ||
    q.includes('spotify') ||
    q.includes('dune') || q.includes('avatar')
  ) {
    return 'entertainment';
  }

  // World keywords (global events, international affairs not geopolitics)
  if (
    q.includes('world') || q.includes('global') || q.includes('international') ||
    q.includes('united nations') || q.includes('un ') || q.includes('summit') ||
    q.includes('g7') || q.includes('g20') || q.includes('davos') || q.includes('wef')
  ) {
    return 'world';
  }

  // Climate & Science - already checked above, skip duplicate
  // Elections keywords
  if (
    q.includes('election') || q.includes('presidential') || q.includes('president') ||
    q.includes('prime minister') || q.includes('governor') || q.includes('mayor') ||
    q.includes('senate') || q.includes('congress') || q.includes('parliament') ||
    q.includes('vote') || q.includes('ballot') || q.includes('re-elect') || q.includes('win the')
  ) {
    return 'elections';
  }

  // If existing category is valid, keep it (trust the source data)
  if (['crypto', 'politics', 'sports', 'tech', 'entertainment', 'economics', 'elections', 'finance', 'geopolitics', 'earnings', 'world', 'climate'].includes(existing)) {
    return existing as Prediction['category'];
  }

  // Default to economics for generic business/company topics, politics only for truly unclassifiable
  if (q.includes('company') || q.includes('corporation') || q.includes('business')) {
    return 'economics';
  }

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
    // Check if outcomes have their own pools
    const outcomeTotalPool = predictionOutcomes.reduce((sum, o) => sum + o.pool, 0);
    const predictionTotalPool = p.yes_pool + p.no_pool;
    
    if (outcomeTotalPool > 0) {
      // Use outcome pools
      totalPool = outcomeTotalPool;
      transformedOutcomes = predictionOutcomes.map(o => ({
        id: o.id,
        label: o.label,
        pool: o.pool,
        odds: Math.round((o.pool / outcomeTotalPool) * 100)
      })).sort((a, b) => b.odds - a.odds);
    } else if (predictionTotalPool > 0 && predictionOutcomes.length === 2) {
      // Fallback: use yes_pool/no_pool for legacy 2-option predictions
      totalPool = predictionTotalPool;
      transformedOutcomes = predictionOutcomes.map((o, index) => {
        const pool = index === 0 ? p.yes_pool : p.no_pool;
        return {
          id: o.id,
          label: o.label,
          pool: pool,
          odds: Math.round((pool / predictionTotalPool) * 100)
        };
      }).sort((a, b) => b.odds - a.odds);
    } else {
      // Default equal split
      totalPool = 0;
      transformedOutcomes = predictionOutcomes.map(o => ({
        id: o.id,
        label: o.label,
        pool: 0,
        odds: Math.round(100 / predictionOutcomes.length)
      }));
    }
    
    // For multi-option, yes/no odds are just for display compatibility
    yesOdds = transformedOutcomes[0]?.odds || 50;
    noOdds = 100 - yesOdds;
  } else {
    totalPool = p.yes_pool + p.no_pool;
    yesOdds = totalPool > 0 ? Math.round((p.yes_pool / totalPool) * 100) : 50;
    noOdds = totalPool > 0 ? 100 - yesOdds : 50;
  }
  
  // Volume in XEC (totalPool is in satoshis, 100 sats = 1 XEC)
  const volumeXEC = totalPool / 100;

  return {
    id: p.id,
    question: p.title,
    description: p.description || '',
    category: detectCategory(p.title, p.category),
    yesOdds,
    noOdds,
    volume: volumeXEC,
    endDate: p.end_date,
    createdAt: p.created_at,
    image: p.image_url || undefined,
    trending: totalPool > 100000,
    escrowAddress: p.escrow_address,
    status: p.status,
    isMultiOption,
    outcomes: transformedOutcomes,
    // Include raw pool values for accurate payout calculations
    yesPool: p.yes_pool,
    noPool: p.no_pool,
  };
};
// Filter to show only the next upcoming daily prediction for repeated series
const filterDailyPredictions = (predictions: Prediction[]): Prediction[] => {
  // Patterns for daily recurring predictions (e.g., "eCash (XEC) Up or Down on January X?")
  const dailyPatterns = [
    /^eCash \(XEC\) Up or Down on (January|February|March|April|May|June|July|August|September|October|November|December) \d+\?$/i,
    /^Bitcoin \(BTC\) Up or Down on (January|February|March|April|May|June|July|August|September|October|November|December) \d+\?$/i,
    /^Ethereum \(ETH\) Up or Down on (January|February|March|April|May|June|July|August|September|October|November|December) \d+\?$/i,
  ];
  
  const dailyGroups: Map<string, Prediction[]> = new Map();
  const nonDaily: Prediction[] = [];
  
  for (const p of predictions) {
    let isDaily = false;
    for (const pattern of dailyPatterns) {
      const match = p.question.match(pattern);
      if (match) {
        // Group by the base pattern (coin name)
        const coinName = p.question.split(' Up or Down')[0];
        if (!dailyGroups.has(coinName)) {
          dailyGroups.set(coinName, []);
        }
        dailyGroups.get(coinName)!.push(p);
        isDaily = true;
        break;
      }
    }
    if (!isDaily) {
      nonDaily.push(p);
    }
  }
  
  // For each daily series, keep only the closest upcoming one (by end_date)
  const result = [...nonDaily];
  for (const [, group] of dailyGroups) {
    // Sort by end_date ascending, take the first (closest)
    group.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    if (group.length > 0) {
      result.push(group[0]);
    }
  }
  
  return result;
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
        const now = new Date().toISOString();
        const [predictionsResult, outcomesResult] = await Promise.all([
          supabase
            .from('predictions')
            .select('*')
            .eq('status', 'active')
            .gt('end_date', now) // Only show predictions that haven't expired
            .order('end_date', { ascending: true }), // Near expiry first
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
        const allPredictions = (predictionsResult.data as DBPrediction[]).map((p) => transformPrediction(p, outcomes));
        
        // Filter to show only next upcoming daily prediction per series
        const filteredPredictions = filterDailyPredictions(allPredictions);
        
        setPredictions(filteredPredictions);
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

    // Single unified channel for all realtime updates
    const realtimeChannel = supabase
      .channel('markets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
        },
        (payload) => {
          console.log('[Realtime] Predictions update:', payload.eventType);
          fetchPredictions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'outcomes',
        },
        (payload) => {
          console.log('[Realtime] Outcomes update:', payload.eventType);
          fetchPredictions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
        },
        (payload) => {
          console.log('[Realtime] Bets update:', payload.eventType);
          // Small delay to ensure trigger has updated pools
          setTimeout(() => fetchPredictions(), 500);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

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
      supabase.removeChannel(realtimeChannel);
    };
  }, [fetchPredictions]);

  return { predictions, loading, error, refetch: fetchPredictions };
};
