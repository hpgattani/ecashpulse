import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OracleResult {
  resolved: boolean;
  outcome?: 'yes' | 'no';
  reason?: string;
  currentValue?: string;
}

// ==================== CRYPTO ORACLES ====================

async function getCryptoPrice(coinId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data[coinId]?.usd || null;
  } catch (error) {
    console.error(`CoinGecko error for ${coinId}:`, error);
    return null;
  }
}

async function checkCryptoPrediction(title: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  const cryptoMap: Record<string, string> = {
    'bitcoin': 'bitcoin', 'btc': 'bitcoin',
    'ethereum': 'ethereum', 'eth': 'ethereum',
    'solana': 'solana', 'sol': 'solana',
    'ecash': 'ecash', 'xec': 'ecash',
    'xrp': 'ripple', 'ripple': 'ripple',
    'cardano': 'cardano', 'ada': 'cardano',
    'dogecoin': 'dogecoin', 'doge': 'dogecoin',
  };

  let coinId: string | null = null;
  let coinName = '';
  
  for (const [keyword, id] of Object.entries(cryptoMap)) {
    if (titleLower.includes(keyword)) {
      coinId = id;
      coinName = keyword.toUpperCase();
      break;
    }
  }
  
  if (!coinId) return { resolved: false };
  
  const price = await getCryptoPrice(coinId);
  if (!price) return { resolved: false };

  // Handle direction predictions
  const isUpPrediction = titleLower.includes('go up') || titleLower.includes('goes up') || 
                         titleLower.includes('will rise') || titleLower.includes('will increase');
  const isDownPrediction = titleLower.includes('go down') || titleLower.includes('goes down') || 
                           titleLower.includes('will fall') || titleLower.includes('will decrease');
  const isUpOrDown = titleLower.includes('up or down') || titleLower.includes('up/down');
  
  if (isUpPrediction || isDownPrediction || isUpOrDown) {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (response.ok) {
        const data = await response.json();
        const priceChange24h = data.market_data?.price_change_percentage_24h;
        
        if (priceChange24h !== undefined) {
          const actuallyUp = priceChange24h >= 0;
          let outcome: 'yes' | 'no';
          if (isUpPrediction) outcome = actuallyUp ? 'yes' : 'no';
          else if (isDownPrediction) outcome = actuallyUp ? 'no' : 'yes';
          else outcome = actuallyUp ? 'yes' : 'no';
          
          return {
            resolved: true,
            outcome,
            reason: `${coinName} 24h: ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%. Current: $${price.toLocaleString()}`,
            currentValue: `$${price.toLocaleString()}`
          };
        }
      }
    } catch (error) {
      console.error('CoinGecko API error:', error);
    }
  }
  
  // Extract target price
  const priceMatch = title.match(/\$?([\d,]+(?:\.\d+)?)\s*(?:k|K)?/);
  if (!priceMatch) return { resolved: false };
  
  let targetPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
  if ((titleLower.includes('k') || titleLower.includes('K')) && targetPrice < 1000) {
    targetPrice *= 1000;
  }
  
  if (titleLower.includes('above') || titleLower.includes('reach') || 
      titleLower.includes('hit') || titleLower.includes('exceed') || titleLower.includes('close')) {
    const reached = price >= targetPrice;
    return {
      resolved: true,
      outcome: reached ? 'yes' : 'no',
      reason: `${coinName}: $${price.toLocaleString()} (target: $${targetPrice.toLocaleString()})`,
      currentValue: `$${price.toLocaleString()}`
    };
  }
  
  return { resolved: false };
}

// ==================== STOCK ORACLES ====================

const STOCK_TICKERS: Record<string, string> = {
  'aapl': 'AAPL', 'apple': 'AAPL',
  'googl': 'GOOGL', 'google': 'GOOGL', 'alphabet': 'GOOGL',
  'open': 'OPEN', 'opendoor': 'OPEN',
  'msft': 'MSFT', 'microsoft': 'MSFT',
  'amzn': 'AMZN', 'amazon': 'AMZN',
  'tsla': 'TSLA', 'tesla': 'TSLA',
  'meta': 'META', 'facebook': 'META',
  'nvda': 'NVDA', 'nvidia': 'NVDA',
};

async function checkStockPrediction(title: string, endDate: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  // Find stock ticker
  let ticker: string | null = null;
  for (const [keyword, symbol] of Object.entries(STOCK_TICKERS)) {
    if (titleLower.includes(keyword) || titleLower.includes(`(${keyword})`)) {
      ticker = symbol;
      break;
    }
  }
  
  if (!ticker) return { resolved: false };
  
  // Only handle "up or down" predictions
  if (!titleLower.includes('up or down')) return { resolved: false };
  
  try {
    // Try Yahoo Finance API (free, no API key)
    const targetDate = new Date(endDate).toISOString().split('T')[0];
    const targetTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
    const prevTimestamp = targetTimestamp - 86400 * 3; // 3 days before
    
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${prevTimestamp}&period2=${targetTimestamp}&interval=1d`;
    
    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    if (response.ok) {
      const data = await response.json();
      const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
      const closes = quotes?.close?.filter((c: number | null) => c !== null);
      
      if (closes && closes.length >= 2) {
        const prevClose = closes[closes.length - 2];
        const lastClose = closes[closes.length - 1];
        const change = ((lastClose - prevClose) / prevClose) * 100;
        const wentUp = lastClose > prevClose;
        
        console.log(`📈 Yahoo Finance: ${ticker} ${prevClose} -> ${lastClose} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
        
        return {
          resolved: true,
          outcome: wentUp ? 'yes' : 'no',
          reason: `${ticker} closed at $${lastClose.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%) on ${targetDate}`,
          currentValue: `$${lastClose.toFixed(2)}`
        };
      }
    }
    
    console.log(`Yahoo Finance unavailable for ${ticker}, stock prediction unresolved`);
    return { resolved: false };
  } catch (error) {
    console.error(`Stock oracle error for ${ticker}:`, error);
    return { resolved: false };
  }
}

async function checkFlippening(): Promise<OracleResult> {
  try {
    const [btcData, ethData] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/coins/bitcoin').then(r => r.json()),
      fetch('https://api.coingecko.com/api/v3/coins/ethereum').then(r => r.json())
    ]);
    
    const btcMcap = btcData.market_data?.market_cap?.usd;
    const ethMcap = ethData.market_data?.market_cap?.usd;
    
    if (btcMcap && ethMcap) {
      const flipped = ethMcap > btcMcap;
      return {
        resolved: true,
        outcome: flipped ? 'yes' : 'no',
        reason: `ETH: $${(ethMcap/1e9).toFixed(0)}B, BTC: $${(btcMcap/1e9).toFixed(0)}B`,
        currentValue: `${(ethMcap/btcMcap*100).toFixed(1)}%`
      };
    }
  } catch (error) {
    console.error('Flippening check error:', error);
  }
  return { resolved: false };
}

// ==================== SPORTS ORACLES ====================

const NFL_TEAMS: Record<string, string[]> = {
  'rams': ['los angeles rams', 'la rams', 'rams'],
  'panthers': ['carolina panthers', 'panthers'],
  'packers': ['green bay packers', 'packers', 'green bay'],
  'bears': ['chicago bears', 'bears', 'chicago'],
  'chiefs': ['kansas city chiefs', 'chiefs', 'kc chiefs'],
  'eagles': ['philadelphia eagles', 'eagles', 'philly'],
  '49ers': ['san francisco 49ers', '49ers', 'niners', 'sf 49ers'],
  'ravens': ['baltimore ravens', 'ravens'],
  'bills': ['buffalo bills', 'bills'],
  'cowboys': ['dallas cowboys', 'cowboys'],
  'lions': ['detroit lions', 'lions'],
  'vikings': ['minnesota vikings', 'vikings'],
  'commanders': ['washington commanders', 'commanders'],
  'steelers': ['pittsburgh steelers', 'steelers'],
  'broncos': ['denver broncos', 'broncos'],
  'chargers': ['los angeles chargers', 'la chargers', 'chargers'],
  'raiders': ['las vegas raiders', 'raiders'],
  'dolphins': ['miami dolphins', 'dolphins'],
  'patriots': ['new england patriots', 'patriots'],
  'jets': ['new york jets', 'jets'],
  'bengals': ['cincinnati bengals', 'bengals'],
  'browns': ['cleveland browns', 'browns'],
  'texans': ['houston texans', 'texans'],
  'colts': ['indianapolis colts', 'colts'],
  'jaguars': ['jacksonville jaguars', 'jaguars'],
  'titans': ['tennessee titans', 'titans'],
  'falcons': ['atlanta falcons', 'falcons'],
  'saints': ['new orleans saints', 'saints'],
  'buccaneers': ['tampa bay buccaneers', 'buccaneers', 'bucs'],
  'cardinals': ['arizona cardinals', 'cardinals'],
  'seahawks': ['seattle seahawks', 'seahawks'],
  'giants': ['new york giants', 'giants'],
};

function parseSpread(title: string): { team: string; spread: number; opponent: string } | null {
  const titleLower = title.toLowerCase();
  const winByMatch = titleLower.match(/win\s+by\s+(?:at\s+least\s+)?(\d+\.?\d*)\s*(?:points?|pts)?/i);
  const spreadMatch = title.match(/([+-]?\d+\.?\d*)\s*(?:points?|pts)?/i);
  
  let spread: number;
  if (winByMatch) {
    spread = -parseFloat(winByMatch[1]);
  } else if (spreadMatch) {
    spread = parseFloat(spreadMatch[1]);
  } else {
    return null;
  }
  
  if (isNaN(spread)) return null;
  
  const teamMatches: string[] = [];
  for (const [key, aliases] of Object.entries(NFL_TEAMS)) {
    for (const alias of aliases) {
      if (titleLower.indexOf(alias) !== -1 && !teamMatches.includes(key)) {
        teamMatches.push(key);
        break;
      }
    }
  }
  
  if (teamMatches.length < 2) return null;
  return { team: teamMatches[0], spread, opponent: teamMatches[1] };
}

async function getScoresFromEspn(team1: string, team2: string): Promise<{ team1Score: number; team2Score: number; finished: boolean; source: string } | null> {
  try {
    const scoreboardRes = await fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard');
    if (!scoreboardRes.ok) return null;

    const scoreboard = await scoreboardRes.json();
    const events = scoreboard?.events || [];
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const t1 = normalize(team1);
    const t2 = normalize(team2);

    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      const competitors = comp?.competitors || [];
      if (competitors.length < 2) continue;

      const names = competitors.map((c: any) => normalize(c?.team?.displayName || c?.team?.name || ''));
      if (!names.some((n: string) => n.includes(t1) || t1.includes(n))) continue;
      if (!names.some((n: string) => n.includes(t2) || t2.includes(n))) continue;

      const statusObj = comp?.status?.type;
      const completed = Boolean(statusObj?.completed);
      if (!completed && statusObj?.state !== 'post') return null;

      let team1Score: number | null = null;
      let team2Score: number | null = null;
      
      for (const c of competitors) {
        const cName = normalize(c?.team?.displayName || c?.team?.name || '');
        const score = c?.score != null ? Number(c.score) : null;
        if (cName.includes(t1) || t1.includes(cName)) team1Score = score;
        else if (cName.includes(t2) || t2.includes(cName)) team2Score = score;
      }

      if (team1Score !== null && team2Score !== null) {
        return { team1Score, team2Score, finished: true, source: 'ESPN' };
      }
    }
    return null;
  } catch (error) {
    console.error('[ESPN] error:', error);
    return null;
  }
}

async function checkSpreadPrediction(title: string): Promise<OracleResult> {
  const parsed = parseSpread(title);
  if (!parsed) return { resolved: false };
  
  const scores = await getScoresFromEspn(parsed.team, parsed.opponent);
  if (!scores) return { resolved: false };
  
  const margin = scores.team1Score - scores.team2Score;
  let covered: boolean;
  if (parsed.spread < 0) {
    covered = margin > Math.abs(parsed.spread);
  } else {
    covered = margin > -parsed.spread;
  }
  
  return {
    resolved: true,
    outcome: covered ? 'yes' : 'no',
    reason: `${parsed.team} ${scores.team1Score}-${scores.team2Score} ${parsed.opponent}, margin: ${margin}, spread: ${parsed.spread}`,
    currentValue: `${scores.team1Score}-${scores.team2Score}`
  };
}

async function checkSportsResult(title: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  // Check for NFL win prediction
  for (const [teamKey, aliases] of Object.entries(NFL_TEAMS)) {
    if (aliases.some(a => titleLower.includes(a))) {
      // Find opponent
      for (const [oppKey, oppAliases] of Object.entries(NFL_TEAMS)) {
        if (oppKey === teamKey) continue;
        if (oppAliases.some(a => titleLower.includes(a))) {
          const scores = await getScoresFromEspn(teamKey, oppKey);
          if (!scores) return { resolved: false };
          
          // Check if asking about team winning
          const teamWon = scores.team1Score > scores.team2Score;
          return {
            resolved: true,
            outcome: teamWon ? 'yes' : 'no',
            reason: `${teamKey} ${scores.team1Score}-${scores.team2Score} ${oppKey}`,
            currentValue: `${scores.team1Score}-${scores.team2Score}`
          };
        }
      }
    }
  }
  
  return { resolved: false };
}

// ==================== NEWS/EVENTS ORACLES ====================

async function queryPerplexity(title: string): Promise<{ resolved: boolean; outcome?: 'yes' | 'no'; reason?: string } | null> {
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!perplexityKey) return null;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: `You are a fact-checker. Given a prediction, search for CURRENT information and determine if the event occurred.

ONLY respond with JSON:
{"resolved": true, "outcome": "yes", "reason": "Brief explanation", "confidence": "high"}
OR {"resolved": true, "outcome": "no", "reason": "Brief explanation", "confidence": "high"}
OR {"resolved": false, "reason": "Not yet occurred"}`
          },
          { 
            role: 'user', 
            content: `Has this prediction been resolved? "${title}" Today: ${new Date().toISOString().split('T')[0]}` 
          }
        ],
        search_recency_filter: 'week',
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const result = JSON.parse(cleaned);
    if (result.resolved && result.outcome && result.confidence === 'high') {
      return { resolved: true, outcome: result.outcome, reason: result.reason };
    }
    return { resolved: false };
  } catch (error) {
    console.error('Perplexity error:', error);
    return null;
  }
}

async function queryLovableAI(title: string, model: string): Promise<{ resolved: boolean; outcome?: 'yes' | 'no'; reason?: string; source: string } | null> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) return null;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { 
            role: 'system', 
            content: `You verify prediction outcomes. ONLY respond with JSON:
{"resolved": true, "outcome": "yes", "reason": "Brief explanation", "confidence": "high"}
OR {"resolved": true, "outcome": "no", "reason": "Brief explanation", "confidence": "high"}
OR {"resolved": false, "reason": "Event unclear"}`
          },
          { 
            role: 'user', 
            content: `Is this prediction resolved? "${title}" Today: ${new Date().toISOString().split('T')[0]}` 
          }
        ],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const result = JSON.parse(cleaned);
    if (result.resolved && result.outcome && result.confidence === 'high') {
      return { resolved: true, outcome: result.outcome, reason: result.reason, source: model };
    }
    return { resolved: false, source: model };
  } catch (error) {
    console.error(`${model} error:`, error);
    return null;
  }
}

async function checkNewsEvent(title: string): Promise<OracleResult> {
  // Try Perplexity first if available (has real-time search)
  const perplexityResult = await queryPerplexity(title);
  
  if (perplexityResult?.resolved && perplexityResult.outcome) {
    console.log(`📰 Perplexity resolved: ${title.slice(0, 40)} -> ${perplexityResult.outcome}`);
    return {
      resolved: true,
      outcome: perplexityResult.outcome,
      reason: `${perplexityResult.reason} [Source: Perplexity Web Search]`,
      currentValue: 'Perplexity'
    };
  }
  
  // Try Lovable AI as fallback (if available, but may hit 402)
  const lovableResult = await queryLovableAI(title, 'google/gemini-2.5-flash');
  
  if (lovableResult?.resolved && lovableResult.outcome) {
    console.log(`🤖 Lovable AI resolved: ${title.slice(0, 40)} -> ${lovableResult.outcome}`);
    return {
      resolved: true,
      outcome: lovableResult.outcome,
      reason: `${lovableResult.reason} [Source: Lovable AI]`,
      currentValue: 'Lovable AI'
    };
  }
  
  // If both AI sources failed, mark as unresolved - needs manual admin resolution
  console.log(`⚠️ News event needs manual resolution: ${title.slice(0, 50)}`);
  return { resolved: false };
}

// ==================== PAYOUT PROCESSING ====================

async function processPayouts(supabase: any, predictionId: string, winningPosition: 'yes' | 'no'): Promise<void> {
  console.log(`💰 Processing payouts for ${predictionId}, winner: ${winningPosition}`);
  
  const { data: prediction, error: predError } = await supabase
    .from('predictions')
    .select('yes_pool, no_pool, title')
    .eq('id', predictionId)
    .single();
  
  if (predError || !prediction) {
    console.error('Failed to fetch prediction:', predError);
    return;
  }
  
  const totalPool = prediction.yes_pool + prediction.no_pool;
  const winningPool = winningPosition === 'yes' ? prediction.yes_pool : prediction.no_pool;
  
  if (totalPool === 0 || winningPool === 0) {
    console.log('No bets or no winning bets, skipping');
    return;
  }
  
  // Get winning bets
  const { data: winningBets, error: betsError } = await supabase
    .from('bets')
    .select('id, user_id, amount, status, payout_amount')
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition)
    .in('status', ['confirmed', 'won']);
  
  if (betsError || !winningBets?.length) {
    console.error('No winning bets found');
    return;
  }
  
  // Calculate and update payouts
  for (const bet of winningBets) {
    if (bet.payout_amount && bet.payout_amount > 0) continue; // Already calculated
    
    const share = bet.amount / winningPool;
    const payout = Math.floor(share * totalPool);
    
    await supabase
      .from('bets')
      .update({ status: 'won', payout_amount: payout })
      .eq('id', bet.id);
    
    console.log(`Bet ${bet.id}: payout=${payout}`);
  }
  
  // Mark losing bets
  const losingPosition = winningPosition === 'yes' ? 'no' : 'yes';
  await supabase
    .from('bets')
    .update({ status: 'lost', payout_amount: 0 })
    .eq('prediction_id', predictionId)
    .eq('position', losingPosition)
    .in('status', ['confirmed', 'lost']);
  
  // Trigger payout
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const { error: payoutError } = await supabase.functions.invoke('send-payouts', {
    body: { prediction_id: predictionId }
  });
  
  if (payoutError) {
    console.error('send-payouts failed:', payoutError);
  } else {
    console.log(`✅ Payout triggered for ${predictionId}`);
  }
}

// ==================== PAYOUT RECOVERY ====================

async function recoverUnpaidPayouts(supabase: any): Promise<number> {
  console.log('🧯 Scanning for unpaid winning bets...');
  
  const { data: unpaidBets, error } = await supabase
    .from('bets')
    .select('prediction_id, payout_amount')
    .eq('status', 'won')
    .is('payout_tx_hash', null)
    .limit(100);
  
  if (error || !unpaidBets?.length) {
    console.log('🧯 No unpaid bets found');
    return 0;
  }
  
  const predictionIds = [...new Set(unpaidBets.map((b: any) => b.prediction_id))];
  console.log(`🧯 Found ${unpaidBets.length} unpaid bets across ${predictionIds.length} predictions`);
  
  let recovered = 0;
  for (const predId of predictionIds.slice(0, 10) as string[]) {
    const { data: pred } = await supabase
      .from('predictions')
      .select('id, status, title, yes_pool, no_pool')
      .eq('id', predId)
      .single();
    
    if (!pred || (pred.status !== 'resolved_yes' && pred.status !== 'resolved_no')) continue;
    
    const winningPosition: 'yes' | 'no' = pred.status === 'resolved_yes' ? 'yes' : 'no';
    
    // Check if payout_amount needs calculation
    const needsCalc = unpaidBets.some((b: any) => b.prediction_id === predId && !b.payout_amount);
    
    if (needsCalc) {
      console.log(`🧯 Recalculating payouts for: ${pred.title?.slice(0, 40)}`);
      await processPayouts(supabase, predId, winningPosition);
    } else {
      console.log(`🧯 Retrying send-payouts for: ${pred.title?.slice(0, 40)}`);
      await supabase.functions.invoke('send-payouts', { body: { prediction_id: predId } });
    }
    recovered++;
  }
  
  return recovered;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Oracle resolver started...');
    
    // Run payout recovery first
    const recoveredCount = await recoverUnpaidPayouts(supabase);
    
    const now = new Date();
    
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('status', 'active')
      .lt('end_date', now.toISOString());
    
    if (error) throw error;
    
    const results: Array<{ id: string; title: string; outcome: string; reason: string; source: string }> = [];
    
    for (const pred of (predictions || [])) {
      // Check resolution_date
      if (pred.resolution_date) {
        const resDate = new Date(pred.resolution_date);
        if (resDate > now) continue;
      }
      
      console.log(`Checking: ${pred.title.slice(0, 50)}...`);
      
      let oracleResult: OracleResult = { resolved: false };
      let source = 'unknown';
      const titleLower = pred.title.toLowerCase();
      
      // NFL buffer check
      const nflTeams = ['nfl', 'patriots', 'eagles', 'chiefs', 'packers', 'bears', 'rams', 'cowboys', 'bills', 'ravens', '49ers', 'lions', 'vikings', 'chargers', 'broncos', 'raiders', 'dolphins', 'jets', 'bengals', 'browns', 'texans', 'colts', 'jaguars', 'titans', 'falcons', 'saints', 'buccaneers', 'cardinals', 'seahawks', 'giants', 'commanders', 'steelers', 'panthers'];
      const isNFL = pred.category === 'sports' || nflTeams.some(t => titleLower.includes(t));
      
      if (isNFL) {
        const hoursSince = (now.getTime() - new Date(pred.end_date).getTime()) / 3600000;
        if (hoursSince < 3) continue;
      }
      
      // Crypto buffer
      const cryptoCoins = ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xec', 'xrp', 'doge', 'ada'];
      const isCrypto = pred.category === 'crypto' || cryptoCoins.some(c => titleLower.includes(c));
      
      if (isCrypto) {
        const hoursSince = (now.getTime() - new Date(pred.end_date).getTime()) / 3600000;
        if (hoursSince < 1) continue;
      }
      
      // Route to appropriate oracle
      const isSpread = titleLower.includes('cover') || titleLower.includes('spread') || 
                       titleLower.match(/-\d+\.?\d*\s*points?/) || titleLower.match(/[+-]\d+\.5/);
      
      // Check for stock tickers
      const stockTickers = ['aapl', 'apple', 'googl', 'google', 'open', 'opendoor', 'msft', 'microsoft', 'amzn', 'amazon', 'tsla', 'tesla', 'meta', 'nvda', 'nvidia'];
      const isStock = stockTickers.some(t => titleLower.includes(t) || titleLower.includes(`(${t})`)) && titleLower.includes('up or down');
      
      if (isSpread) {
        oracleResult = await checkSpreadPrediction(pred.title);
        source = 'NFL Score Oracle';
      } else if (titleLower.includes('flippen')) {
        oracleResult = await checkFlippening();
        source = 'CoinGecko';
      } else if (isStock) {
        oracleResult = await checkStockPrediction(pred.title, pred.end_date);
        source = 'Stock Oracle';
      } else if (isCrypto) {
        oracleResult = await checkCryptoPrediction(pred.title);
        source = 'CoinGecko';
      } else if (isNFL) {
        oracleResult = await checkSportsResult(pred.title);
        source = 'ESPN';
      } else {
        oracleResult = await checkNewsEvent(pred.title);
        source = 'Multi-source AI';
      }
      
      // Fallback to news oracle
      if (!oracleResult.resolved) {
        oracleResult = await checkNewsEvent(pred.title);
        source = 'AI Fallback';
      }
      
      if (oracleResult.resolved && oracleResult.outcome) {
        const winningPosition = oracleResult.outcome;
        const status = winningPosition === 'yes' ? 'resolved_yes' : 'resolved_no';

        await supabase
          .from('predictions')
          .update({
            status,
            resolved_at: new Date().toISOString(),
            description: `${pred.description || ''}\n\n---\nOracle: ${winningPosition.toUpperCase()} via ${source}\n${oracleResult.reason || ''}`.trim(),
          })
          .eq('id', pred.id);

        await processPayouts(supabase, pred.id, winningPosition);

        results.push({
          id: pred.id,
          title: pred.title,
          outcome: winningPosition,
          reason: oracleResult.reason || 'Verified',
          source
        });

        console.log(`✓ Resolved: ${pred.title.slice(0, 40)} -> ${winningPosition}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return new Response(
      JSON.stringify({ success: true, checked: predictions?.length || 0, resolved: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Oracle error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
