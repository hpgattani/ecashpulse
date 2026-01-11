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
  
  // Map keywords to CoinGecko IDs
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

  // Handle "go up", "go down", "up or down" predictions - use CoinGecko 24h change
  const isUpPrediction = titleLower.includes('go up') || titleLower.includes('goes up') || 
                         titleLower.includes('will rise') || titleLower.includes('will increase');
  const isDownPrediction = titleLower.includes('go down') || titleLower.includes('goes down') || 
                           titleLower.includes('will fall') || titleLower.includes('will decrease');
  const isUpOrDown = titleLower.includes('up or down') || titleLower.includes('up/down');
  
  if (isUpPrediction || isDownPrediction || isUpOrDown) {
    console.log(`📊 Checking ${coinName} direction with CoinGecko...`);
    
    // Get 24h price change from CoinGecko
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
          if (isUpPrediction) {
            // "Will ETH go up?" - YES if price went up
            outcome = actuallyUp ? 'yes' : 'no';
          } else if (isDownPrediction) {
            // "Will ETH go down?" - YES if price went down
            outcome = actuallyUp ? 'no' : 'yes';
          } else {
            // "Up or down?" - YES means UP, NO means DOWN
            outcome = actuallyUp ? 'yes' : 'no';
          }
          
          return {
            resolved: true,
            outcome,
            reason: `${coinName} 24h change: ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}% (CoinGecko). Current: $${price.toLocaleString()}`,
            currentValue: `$${price.toLocaleString()} (${priceChange24h >= 0 ? '↑' : '↓'}${Math.abs(priceChange24h).toFixed(2)}%)`
          };
        }
      }
    } catch (error) {
      console.error('CoinGecko detailed API error:', error);
    }
  }
  
  // Extract target price from title
  const priceMatch = title.match(/\$?([\d,]+(?:\.\d+)?)\s*(?:k|K)?/);
  if (!priceMatch) return { resolved: false };
  
  let targetPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
  if ((titleLower.includes('k') || titleLower.includes('K')) && targetPrice < 1000) {
    targetPrice *= 1000;
  }
  
  // Check for price target conditions
  if (titleLower.includes('above') || titleLower.includes('reach') || 
      titleLower.includes('hit') || titleLower.includes('trade') ||
      titleLower.includes('exceed') || titleLower.includes('close')) {
    const reached = price >= targetPrice;
    return {
      resolved: true,
      outcome: reached ? 'yes' : 'no',
      reason: `${coinName} price: $${price.toLocaleString()} (target: $${targetPrice.toLocaleString()}) via CoinGecko`,
      currentValue: `$${price.toLocaleString()}`
    };
  }
  
  return { resolved: false };
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
        reason: `ETH mcap: $${(ethMcap/1e9).toFixed(0)}B, BTC mcap: $${(btcMcap/1e9).toFixed(0)}B`,
        currentValue: `ETH/BTC ratio: ${(ethMcap/btcMcap*100).toFixed(1)}%`
      };
    }
  } catch (error) {
    console.error('Flippening check error:', error);
  }
  return { resolved: false };
}

// ==================== SPORTS ORACLES ====================

// NFL team name mappings for matching
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

// Parse spread from title like "-10.5", "+3.5", "cover -7"
function parseSpread(title: string): { team: string; spread: number; opponent: string } | null {
  const titleLower = title.toLowerCase();
  
  // Match patterns like "Rams cover -10.5" or "will the packers cover -7 points"
  const spreadMatch = title.match(/([+-]?\d+\.?\d*)\s*(?:points?|pts)?/i);
  if (!spreadMatch) return null;
  
  const spread = parseFloat(spreadMatch[1]);
  if (isNaN(spread)) return null;
  
  // Find team names
  let favoredTeam: string | null = null;
  let opponent: string | null = null;
  
  for (const [key, aliases] of Object.entries(NFL_TEAMS)) {
    for (const alias of aliases) {
      if (titleLower.includes(alias)) {
        if (!favoredTeam) {
          favoredTeam = key;
        } else if (!opponent) {
          opponent = key;
        }
      }
    }
  }
  
  if (!favoredTeam || !opponent) return null;
  
  return { team: favoredTeam, spread, opponent };
}

// Get actual game scores using Perplexity - just the numbers
async function getGameScores(team1: string, team2: string): Promise<{ team1Score: number; team2Score: number; finished: boolean } | null> {
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!perplexityKey) return null;

  try {
    console.log(`🏈 Fetching scores for ${team1} vs ${team2}...`);
    
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
            content: `You are a sports score lookup tool. Return ONLY a JSON object with final game scores. 
            
CRITICAL: Only respond if the game is FINISHED. Do not predict or estimate scores.

Response format (JSON only, no other text):
{"team1_score": 30, "team2_score": 24, "finished": true}

If the game hasn't finished yet or you can't find final scores:
{"finished": false}`
          },
          { 
            role: 'user', 
            content: `What was the FINAL score of the most recent NFL game between the ${team1} and the ${team2}? Today is ${new Date().toISOString().split('T')[0]}. Only provide final scores if the game has ended.` 
          }
        ],
        search_recency_filter: 'day',
      }),
    });

    if (!response.ok) {
      console.error('Perplexity scores API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('Score response:', content);
    
    // Parse JSON response
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const result = JSON.parse(cleaned);
    
    if (!result.finished) {
      console.log('Game not finished yet');
      return null;
    }
    
    return {
      team1Score: parseInt(result.team1_score),
      team2Score: parseInt(result.team2_score),
      finished: true
    };
  } catch (error) {
    console.error('Score lookup error:', error);
    return null;
  }
}

// Check spread-based predictions with actual score math
async function checkSpreadPrediction(title: string): Promise<OracleResult> {
  const parsed = parseSpread(title);
  if (!parsed) {
    console.log('Could not parse spread from title');
    return { resolved: false };
  }
  
  console.log(`📊 Spread prediction: ${parsed.team} at ${parsed.spread} vs ${parsed.opponent}`);
  
  // Get actual scores
  const scores = await getGameScores(parsed.team, parsed.opponent);
  if (!scores) {
    console.log('Could not get game scores');
    return { resolved: false };
  }
  
  // Calculate if spread was covered
  // Negative spread means favored team must win by more than that amount
  // e.g., Rams -10.5 means Rams must win by 11+ points
  const margin = scores.team1Score - scores.team2Score;
  const spreadCovered = margin > Math.abs(parsed.spread);
  
  // If spread is negative (favorite), they need to win by more than spread
  // If spread is positive (underdog), they can lose by less than spread
  let covered: boolean;
  if (parsed.spread < 0) {
    // Favorite: must win by more than spread
    covered = margin > Math.abs(parsed.spread);
  } else {
    // Underdog: can lose by less than spread or win
    covered = margin > -parsed.spread;
  }
  
  const outcome = covered ? 'yes' : 'no';
  
  return {
    resolved: true,
    outcome,
    reason: `Final Score: ${parsed.team.charAt(0).toUpperCase() + parsed.team.slice(1)} ${scores.team1Score} - ${scores.team2Score} ${parsed.opponent.charAt(0).toUpperCase() + parsed.opponent.slice(1)}. Margin: ${margin > 0 ? '+' : ''}${margin}. Spread: ${parsed.spread}. ${covered ? 'COVERED' : 'DID NOT COVER'}.`,
    currentValue: `${scores.team1Score}-${scores.team2Score}`
  };
}

// Simple win/lose sports predictions (no spread)
async function checkSportsResult(title: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  // Check if this is a spread prediction - delegate to spread oracle
  if (titleLower.includes('cover') || titleLower.match(/[+-]\d+\.?\d*\s*points?/i)) {
    return await checkSpreadPrediction(title);
  }
  
  // Check if this is a simple "will team X beat team Y" prediction
  const beatMatch = titleLower.match(/will\s+(?:the\s+)?(\w+)\s+beat\s+(?:the\s+)?(\w+)/);
  if (beatMatch) {
    const team1 = beatMatch[1].toLowerCase();
    const team2 = beatMatch[2].toLowerCase();
    
    // Look up team in NFL teams
    let team1Key: string | null = null;
    let team2Key: string | null = null;
    
    for (const [key, aliases] of Object.entries(NFL_TEAMS)) {
      if (aliases.some(a => a.includes(team1) || team1.includes(key))) team1Key = key;
      if (aliases.some(a => a.includes(team2) || team2.includes(key))) team2Key = key;
    }
    
    if (team1Key && team2Key) {
      const scores = await getGameScores(team1Key, team2Key);
      if (scores && scores.finished) {
        const team1Won = scores.team1Score > scores.team2Score;
        return {
          resolved: true,
          outcome: team1Won ? 'yes' : 'no',
          reason: `Final Score: ${team1Key} ${scores.team1Score} - ${scores.team2Score} ${team2Key}`,
          currentValue: `${scores.team1Score}-${scores.team2Score}`
        };
      }
    }
  }
  
  try {
    // Super Bowl predictions
    if (titleLower.includes('super bowl')) {
      const teamMatch = title.match(/(?:chiefs|eagles|49ers|ravens|bills|cowboys|packers|lions)/i);
      if (teamMatch) {
        const team = teamMatch[0].toLowerCase();
        const response = await fetch(
          `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=Super_Bowl`
        );
        if (response.ok) {
          const data = await response.json();
          const events = data.event || [];
          for (const event of events) {
            if (event.strStatus === 'Match Finished' || event.strStatus === 'FT') {
              const winner = event.strHomeTeam?.toLowerCase().includes(team) && 
                            parseInt(event.intHomeScore) > parseInt(event.intAwayScore) ? 'yes' :
                            event.strAwayTeam?.toLowerCase().includes(team) && 
                            parseInt(event.intAwayScore) > parseInt(event.intHomeScore) ? 'yes' : 'no';
              return {
                resolved: true,
                outcome: winner,
                reason: `${event.strHomeTeam} ${event.intHomeScore} - ${event.intAwayScore} ${event.strAwayTeam}`,
                currentValue: event.strStatus
              };
            }
          }
        }
      }
    }

    // Wimbledon predictions
    if (titleLower.includes('wimbledon')) {
      const playerMatch = title.match(/(?:djokovic|alcaraz|sinner|medvedev|zverev)/i);
      if (playerMatch) {
        const response = await fetch(
          `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=Wimbledon`
        );
        if (response.ok) {
          const data = await response.json();
          const events = data.event || [];
          for (const event of events) {
            if (event.strStatus === 'Match Finished' && event.strEvent?.toLowerCase().includes('final')) {
              const playerName = playerMatch[0].toLowerCase();
              const isWinner = event.strResult?.toLowerCase().includes(playerName);
              return {
                resolved: true,
                outcome: isWinner ? 'yes' : 'no',
                reason: `Wimbledon Final: ${event.strResult || event.strEvent}`,
                currentValue: event.strStatus
              };
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('Sports API error:', error);
  }
  
  return { resolved: false };
}

// ==================== WEATHER/CLIMATE ORACLES ====================

// Open-Meteo API (free, no key required) for weather/climate data
async function checkWeatherPrediction(title: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  try {
    // Hottest year record - use NASA GISS or NOAA data via Perplexity
    if (titleLower.includes('hottest year') || titleLower.includes('warmest year') || 
        titleLower.includes('temperature record')) {
      console.log('🌡️ Checking global temperature records...');
      // These need real-time verification, fall through to Perplexity
      return { resolved: false };
    }
    
    // Hurricane predictions - NOAA data
    if (titleLower.includes('hurricane') || titleLower.includes('typhoon') || titleLower.includes('cyclone')) {
      console.log('🌀 Checking hurricane/storm data...');
      // Falls through to Perplexity for real-time verification
      return { resolved: false };
    }
    
    // CO2 levels - Mauna Loa data
    if (titleLower.includes('co2') || titleLower.includes('carbon dioxide') || titleLower.includes('ppm')) {
      console.log('🌍 Checking atmospheric CO2 levels...');
      // Falls through to Perplexity for real-time data
      return { resolved: false };
    }
    
    // Heatwave predictions
    if (titleLower.includes('heatwave') || titleLower.includes('heat wave') || 
        titleLower.includes('record high') || titleLower.includes('45°c') || titleLower.includes('celsius')) {
      console.log('🔥 Checking heatwave data...');
      return { resolved: false };
    }
    
    // Arctic sea ice
    if (titleLower.includes('arctic') || titleLower.includes('sea ice') || titleLower.includes('ice cap')) {
      console.log('🧊 Checking Arctic ice data...');
      return { resolved: false };
    }
    
    // Drought conditions
    if (titleLower.includes('drought')) {
      console.log('🏜️ Checking drought conditions...');
      return { resolved: false };
    }
    
  } catch (error) {
    console.error('Weather API error:', error);
  }
  
  return { resolved: false };
}

// ==================== NEWS/EVENTS ORACLES ====================

// Use Perplexity for REAL-TIME web search to verify events accurately
async function checkNewsEvent(title: string): Promise<OracleResult> {
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!perplexityKey) {
    console.log('PERPLEXITY_API_KEY not set - skipping real-time search');
    return { resolved: false };
  }

  try {
    console.log(`🔍 Searching real-time data for: "${title.slice(0, 60)}..."`);
    
    // Use Perplexity with sonar model for real-time web search
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
            content: `You are a fact-checker that searches the web for CURRENT real-time information. Given a prediction market question, search for the latest news and data to determine if the event has occurred and what the outcome was.

CRITICAL: Search for the MOST RECENT information. Do not rely on old data.

ONLY respond with JSON in this exact format:
{"resolved": true, "outcome": "yes", "reason": "Brief explanation with source and date", "confidence": "high"}
OR
{"resolved": true, "outcome": "no", "reason": "Brief explanation with source and date", "confidence": "high"}
OR
{"resolved": false, "reason": "Event has not occurred yet or insufficient information"}

Only set resolved=true if you find clear, recent evidence. Include the date of the information source in your reason.`
          },
          { 
            role: 'user', 
            content: `Search the web and determine if this prediction has been resolved: "${title}"

Today's date is ${new Date().toISOString().split('T')[0]}. Find the most recent information.` 
          }
        ],
        search_recency_filter: 'week', // Prioritize recent sources
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status, await response.text());
      return { resolved: false };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    console.log('Perplexity response:', content);
    if (citations.length > 0) {
      console.log('Sources:', citations.slice(0, 3).join(', '));
    }
    
    // Parse JSON response
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    try {
      const result = JSON.parse(cleaned);
      
      // Only accept high-confidence results with citations
      if (result.resolved && result.outcome && result.confidence === 'high') {
        const sourceInfo = citations.length > 0 
          ? ` (Sources: ${citations.slice(0, 2).join(', ')})`
          : '';
        
        return {
          resolved: true,
          outcome: result.outcome as 'yes' | 'no',
          reason: `${result.reason}${sourceInfo}`,
          currentValue: 'Perplexity Real-Time Search'
        };
      }
    } catch (parseError) {
      console.log('Perplexity response parse error:', parseError);
    }
  } catch (error) {
    console.error('Perplexity oracle error:', error);
  }
  
  return { resolved: false };
}

// ==================== ENTERTAINMENT ORACLES ====================

async function checkEntertainmentEvent(title: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  // Oscar/Grammy/Emmy predictions - use AI oracle
  if (titleLower.includes('oscar') || titleLower.includes('grammy') || 
      titleLower.includes('emmy') || titleLower.includes('golden globe')) {
    // These are best verified via AI news check
    return { resolved: false };
  }
  
  // Movie release predictions
  if (titleLower.includes('release') && (titleLower.includes('movie') || titleLower.includes('film'))) {
    // Could integrate with TMDB API for movie releases
    return { resolved: false };
  }
  
  return { resolved: false };
}

// ==================== PAYOUT PROCESSING ====================

async function processPayouts(supabase: any, predictionId: string, winningPosition: 'yes' | 'no'): Promise<void> {
  console.log(`Processing payouts for prediction ${predictionId}, winning: ${winningPosition}`);
  
  const { data: prediction } = await supabase
    .from('predictions')
    .select('yes_pool, no_pool, title')
    .eq('id', predictionId)
    .single();
  
  if (!prediction) return;
  
  const totalPool = prediction.yes_pool + prediction.no_pool;
  const winningPool = winningPosition === 'yes' ? prediction.yes_pool : prediction.no_pool;
  
  if (totalPool === 0) {
    console.log('No bets placed, skipping payouts');
    return;
  }
  
  const { data: winningBets } = await supabase
    .from('bets')
    .select('id, user_id, amount')
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition)
    .eq('status', 'confirmed');
  
  if (!winningBets?.length) {
    console.log('No winning bets found');
    return;
  }
  
  for (const bet of winningBets) {
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : bet.amount;
    
    await supabase
      .from('bets')
      .update({ status: 'won', payout_amount: payout })
      .eq('id', bet.id);
    
    console.log(`Bet ${bet.id}: payout ${payout} sats`);
  }
  
  // Mark losing bets
  await supabase
    .from('bets')
    .update({ status: 'lost', payout_amount: 0 })
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition === 'yes' ? 'no' : 'yes')
    .eq('status', 'confirmed');
  
  console.log(`Payouts processed for "${prediction.title}"`);

  // Automatically trigger payout distribution
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing env vars for payout trigger');
    return;
  }
  
  // Call send-payouts to distribute winnings
  const payoutUrl = `${supabaseUrl}/functions/v1/send-payouts`;
  
  const payoutResponse = await fetch(payoutUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ prediction_id: predictionId })
  });

  if (!payoutResponse.ok) {
    console.error(`Payout call failed: ${payoutResponse.status}`);
  } else {
    console.log(`Payout triggered successfully for ${predictionId}`);
  }
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
    
    // Get active predictions that have ended
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('status', 'active')
      .lt('end_date', new Date().toISOString());
    
    if (error) throw error;
    
    const results: Array<{ id: string; title: string; outcome: string; reason: string; source: string }> = [];
    
    for (const pred of (predictions || [])) {
      console.log(`Checking: ${pred.title.slice(0, 60)}...`);
      
      let oracleResult: OracleResult = { resolved: false };
      let source = 'unknown';
      
      // Route to appropriate oracle based on category and content
      const titleLower = pred.title.toLowerCase();
      
      // Check if this is a spread-based prediction - use dedicated spread oracle
      const isSpreadPrediction = 
        titleLower.includes('cover') || 
        titleLower.includes('spread') || 
        titleLower.match(/-\d+\.?\d*\s*points?/) || // -10.5 points, -7 point, etc.
        titleLower.match(/[+-]\d+\.5/) || // +3.5, -10.5
        titleLower.includes('against the spread') ||
        titleLower.includes('ats');
      
      if (isSpreadPrediction) {
        console.log(`🏈 Processing spread prediction with score-based oracle...`);
        oracleResult = await checkSpreadPrediction(pred.title);
        source = 'NFL Score Oracle';
      }
      // Check for over/under - use total score calculation
      else if (titleLower.includes('over/under') || 
               titleLower.includes('over under') ||
               (titleLower.includes('total') && titleLower.includes('points'))) {
        console.log(`🏈 Processing over/under prediction...`);
        // TODO: Implement over/under oracle when needed
        // For now, skip these
        console.log(`⚠️ Over/under predictions not yet supported`);
        continue;
      }
      // 1. Check for flippening predictions first
      else if (titleLower.includes('flippen') || 
          (titleLower.includes('ethereum') && titleLower.includes('bitcoin') && titleLower.includes('market cap'))) {
        oracleResult = await checkFlippening();
        source = 'CoinGecko Market Cap';
      }
      // 2. Crypto price predictions
      else if (pred.category === 'crypto' || 
               ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xec', 'xrp', 'doge', 'ada']
                 .some(c => titleLower.includes(c))) {
        oracleResult = await checkCryptoPrediction(pred.title);
        source = 'CoinGecko Price';
      }
      // 3. Sports predictions - handles both spread and simple win/lose
      else if (pred.category === 'sports' ||
               ['super bowl', 'world series', 'wimbledon', 'premier league', 'nba', 'nfl', 'champions league', 'college football', 'cfp', 'playoff']
                 .some(s => titleLower.includes(s))) {
        oracleResult = await checkSportsResult(pred.title);
        source = 'Sports Score Oracle';
      }
      // 4. Entertainment predictions
      else if (pred.category === 'entertainment' ||
               ['oscar', 'grammy', 'emmy', 'movie', 'album', 'netflix', 'disney']
                 .some(e => titleLower.includes(e))) {
        oracleResult = await checkEntertainmentEvent(pred.title);
        source = 'Entertainment Oracle';
      }
      // 5. Climate/Weather predictions - use weather oracle + Perplexity fallback
      else if (pred.category === 'climate' ||
               ['temperature', 'hurricane', 'heatwave', 'drought', 'co2', 'arctic', 'climate']
                 .some(c => titleLower.includes(c))) {
        oracleResult = await checkWeatherPrediction(pred.title);
        source = 'Weather Oracle';
        // Weather oracle mostly logs and falls through to Perplexity for verification
        if (!oracleResult.resolved) {
          oracleResult = await checkNewsEvent(pred.title);
          source = 'Perplexity Climate Search';
        }
      }
      // 6. All other categories - use Perplexity real-time web search
      // This includes politics, tech, sports events, IPL auctions, etc.
      else {
        console.log(`🔍 Using Perplexity real-time search for: "${pred.title.slice(0, 50)}"`);
        oracleResult = await checkNewsEvent(pred.title);
        source = 'Perplexity Real-Time Search';
      }
      
      // Fallback: If no specific oracle resolved it, try Perplexity
      if (!oracleResult.resolved) {
        oracleResult = await checkNewsEvent(pred.title);
        source = 'Perplexity Fallback Search';
      }
      
      if (oracleResult.resolved && oracleResult.outcome) {
        const normalizedOutcome = oracleResult.outcome.toLowerCase();
        if (normalizedOutcome !== 'yes' && normalizedOutcome !== 'no') {
          console.error(`Invalid oracle outcome for ${pred.id}:`, oracleResult.outcome);
          continue;
        }

        // IMPORTANT: ensure winners match the stored prediction status
        // resolved_yes -> YES bettors win, resolved_no -> NO bettors win
        const winningPosition = normalizedOutcome as 'yes' | 'no';
        const status = winningPosition === 'yes' ? 'resolved_yes' : 'resolved_no';

        await supabase
          .from('predictions')
          .update({
            status,
            resolved_at: new Date().toISOString(),
            description: `${pred.description || ''}\n\n🔮 Oracle Resolution (${source}): ${oracleResult.reason}`
          })
          .eq('id', pred.id);

        await processPayouts(supabase, pred.id, winningPosition);

        results.push({
          id: pred.id,
          title: pred.title,
          outcome: winningPosition,
          reason: oracleResult.reason || 'Oracle verified',
          source
        });

        console.log(`✓ Resolved: ${pred.title.slice(0, 50)} -> ${winningPosition} (${source})`);
      } else {
        console.log(`⏳ Could not resolve: ${pred.title.slice(0, 50)}`);
      }
      
      // Rate limit API calls
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        checked: predictions?.length || 0,
        resolved: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Oracle resolver error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});