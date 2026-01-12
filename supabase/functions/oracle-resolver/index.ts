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

// Parse spread from title like "-10.5", "+3.5", "cover -7", or "win by at least 1.5 points"
function parseSpread(title: string): { team: string; spread: number; opponent: string } | null {
  const titleLower = title.toLowerCase();
  
  // Match "win by at least X points" pattern (the favored team needs to win by that margin)
  const winByMatch = titleLower.match(/win\s+by\s+(?:at\s+least\s+)?(\d+\.?\d*)\s*(?:points?|pts)?/i);
  // Match patterns like "cover -10.5" or "will the packers cover -7 points"
  const spreadMatch = title.match(/([+-]?\d+\.?\d*)\s*(?:points?|pts)?/i);
  
  let spread: number;
  
  if (winByMatch) {
    // "win by at least X" means they need margin > X (like a negative spread)
    spread = -parseFloat(winByMatch[1]); // Negative because it's a "must win by" condition
    console.log(`Parsed "win by at least" pattern: spread = ${spread}`);
  } else if (spreadMatch) {
    spread = parseFloat(spreadMatch[1]);
    console.log(`Parsed standard spread pattern: spread = ${spread}`);
  } else {
    return null;
  }
  
  if (isNaN(spread)) return null;
  
  // Find team names in order of appearance
  const teamMatches: string[] = [];
  
  for (const [key, aliases] of Object.entries(NFL_TEAMS)) {
    for (const alias of aliases) {
      const idx = titleLower.indexOf(alias);
      if (idx !== -1 && !teamMatches.includes(key)) {
        teamMatches.push(key);
        break;
      }
    }
  }
  
  if (teamMatches.length < 2) return null;
  
  // First team mentioned is the "favored" team (the one the question is about)
  return { team: teamMatches[0], spread, opponent: teamMatches[1] };
}

// Get actual game scores using ESPN API as primary source
async function getScoresFromEspn(team1: string, team2: string): Promise<{ team1Score: number; team2Score: number; finished: boolean; source: string } | null> {
  try {
    console.log(`🏈 [ESPN] Fetching scores for ${team1} vs ${team2}...`);
    
    const scoreboardRes = await fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard');
    if (!scoreboardRes.ok) {
      console.error('ESPN scoreboard fetch failed:', scoreboardRes.status);
      return null;
    }

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
      const has1 = names.some((n: string) => n.includes(t1) || t1.includes(n));
      const has2 = names.some((n: string) => n.includes(t2) || t2.includes(n));
      if (!has1 || !has2) continue;

      const statusObj = comp?.status?.type;
      const state = statusObj?.state as string | undefined;
      const completed = Boolean(statusObj?.completed);

      if (!completed && state !== 'post') {
        console.log(`[ESPN] Game found but not finished yet (state: ${state})`);
        return null;
      }

      // Find which competitor matches team1 and team2
      let team1Score: number | null = null;
      let team2Score: number | null = null;
      
      for (const c of competitors) {
        const cName = normalize(c?.team?.displayName || c?.team?.name || '');
        const score = c?.score != null ? Number(c.score) : null;
        
        if (cName.includes(t1) || t1.includes(cName)) {
          team1Score = score;
        } else if (cName.includes(t2) || t2.includes(cName)) {
          team2Score = score;
        }
      }

      if (team1Score !== null && team2Score !== null) {
        console.log(`✅ [ESPN] Final scores: ${team1} ${team1Score} - ${team2Score} ${team2}`);
        return { team1Score, team2Score, finished: true, source: 'ESPN' };
      }
    }

    console.log('[ESPN] No matching game found');
    return null;
  } catch (error) {
    console.error('[ESPN] Score lookup error:', error);
    return null;
  }
}

// Fallback: Get scores using Perplexity (only if ESPN fails)
async function getScoresFromPerplexity(team1: string, team2: string): Promise<{ team1Score: number; team2Score: number; finished: boolean; source: string } | null> {
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!perplexityKey) return null;

  try {
    console.log(`🏈 [Perplexity] Fetching scores for ${team1} vs ${team2}...`);
    
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
Double-check the score from official NFL sources.

Response format (JSON only, no other text):
{"team1_score": 30, "team2_score": 24, "finished": true}

If the game hasn't finished yet or you can't find verified final scores:
{"finished": false}`
          },
          { 
            role: 'user', 
            content: `What was the OFFICIAL FINAL score of the most recent NFL game between the ${team1} and the ${team2}? Today is ${new Date().toISOString().split('T')[0]}. Verify from NFL.com or ESPN. Only provide final scores if the game has completely ended.` 
          }
        ],
        search_recency_filter: 'day',
      }),
    });

    if (!response.ok) {
      console.error('[Perplexity] API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[Perplexity] Response:', content);
    
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const result = JSON.parse(cleaned);
    
    if (!result.finished) {
      console.log('[Perplexity] Game not finished yet');
      return null;
    }
    
    return {
      team1Score: parseInt(result.team1_score),
      team2Score: parseInt(result.team2_score),
      finished: true,
      source: 'Perplexity'
    };
  } catch (error) {
    console.error('[Perplexity] Score lookup error:', error);
    return null;
  }
}

// Multi-source score verification - ESPN ONLY for reliable resolution
// CRITICAL: Never trust Perplexity-only scores for NFL - too error-prone
async function getGameScores(team1: string, team2: string): Promise<{ team1Score: number; team2Score: number; finished: boolean; source: string } | null> {
  // Primary and ONLY trusted source: ESPN API (official live data)
  const espnScores = await getScoresFromEspn(team1, team2);
  
  if (espnScores) {
    console.log(`✅ Using ESPN scores (official): ${team1} ${espnScores.team1Score} - ${espnScores.team2Score} ${team2}`);
    
    // Optional: Log Perplexity for debugging but NEVER use it for resolution
    const perplexityScores = await getScoresFromPerplexity(team1, team2);
    
    if (perplexityScores) {
      if (espnScores.team1Score === perplexityScores.team1Score && 
          espnScores.team2Score === perplexityScores.team2Score) {
        console.log(`✅ Perplexity agrees with ESPN (for logging only)`);
      } else {
        // Perplexity is WRONG - log this for evidence
        console.warn(`🚨 PERPLEXITY ERROR DETECTED! ESPN (trusted): ${espnScores.team1Score}-${espnScores.team2Score}, Perplexity (wrong): ${perplexityScores.team1Score}-${perplexityScores.team2Score}`);
        console.warn(`🚨 This is why we NEVER trust Perplexity for sports scores.`);
      }
    }
    
    return { ...espnScores, source: 'ESPN (official)' };
  }
  
  // CRITICAL FIX: Do NOT fall back to Perplexity for NFL scores
  // Perplexity has been proven unreliable (e.g., Patriots vs Chargers error)
  console.error(`❌ ESPN did not return scores for ${team1} vs ${team2}`);
  console.error(`❌ BLOCKING RESOLUTION: Perplexity fallback disabled for NFL to prevent wrong payouts`);
  console.error(`❌ This prediction must wait for ESPN data or be resolved manually by admin`);
  
  // DO NOT USE PERPLEXITY - return null to block auto-resolution
  return null;
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
    reason: `Final Score: ${parsed.team.charAt(0).toUpperCase() + parsed.team.slice(1)} ${scores.team1Score} - ${scores.team2Score} ${parsed.opponent.charAt(0).toUpperCase() + parsed.opponent.slice(1)}. Margin: ${margin > 0 ? '+' : ''}${margin}. Spread: ${parsed.spread}. ${covered ? 'COVERED' : 'DID NOT COVER'}. (Source: ${scores.source})`,
    currentValue: `${scores.team1Score}-${scores.team2Score}`
  };
}

// Simple win/lose sports predictions (no spread)
async function checkSportsResult(title: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  // Check if this is a spread prediction - delegate to spread oracle
  // Includes: "cover", "-10.5 points", "+3.5", "win by at least X"
  if (titleLower.includes('cover') || 
      titleLower.match(/[+-]\d+\.?\d*\s*points?/i) ||
      titleLower.includes('win by at least') ||
      titleLower.includes('win by ')) {
    console.log(`🏈 Routing to spread oracle: "${title.slice(0, 60)}..."`);
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

// Query a single AI source for verification
async function queryPerplexity(title: string): Promise<{ resolved: boolean; outcome?: 'yes' | 'no'; reason?: string; citations?: string[] } | null> {
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
        search_recency_filter: 'week',
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const result = JSON.parse(cleaned);
    if (result.resolved && result.outcome && result.confidence === 'high') {
      return { resolved: true, outcome: result.outcome, reason: result.reason, citations };
    }
    return { resolved: false };
  } catch (error) {
    console.error('Perplexity query error:', error);
    return null;
  }
}

// Query Lovable AI as a second verification source
async function queryLovableAI(title: string): Promise<{ resolved: boolean; outcome?: 'yes' | 'no'; reason?: string } | null> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) {
    console.log('LOVABLE_API_KEY not set - skipping AI verification');
    return null;
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: `You are a fact-checker verifying prediction market outcomes. Given a prediction question, determine if the event has definitively occurred based on your training data.

IMPORTANT: Only respond with high confidence if you are CERTAIN about the outcome. If you're unsure or the event hasn't happened yet, say resolved=false.

ONLY respond with JSON in this exact format:
{"resolved": true, "outcome": "yes", "reason": "Brief explanation", "confidence": "high"}
OR
{"resolved": true, "outcome": "no", "reason": "Brief explanation", "confidence": "high"}
OR
{"resolved": false, "reason": "Event unclear or not yet occurred"}

Be conservative - only resolve if you're absolutely certain.`
          },
          { 
            role: 'user', 
            content: `Determine if this prediction has been resolved: "${title}"

Today's date is ${new Date().toISOString().split('T')[0]}.` 
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error('Lovable AI error:', response.status);
      return null;
    }

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
    console.error('Lovable AI query error:', error);
    return null;
  }
}

// Multi-source verification for news/events - BOTH sources must agree
async function checkNewsEvent(title: string): Promise<OracleResult> {
  console.log(`🔍 Multi-source verification for: "${title.slice(0, 60)}..."`);
  
  // Query both sources in parallel
  const [perplexityResult, lovableResult] = await Promise.all([
    queryPerplexity(title),
    queryLovableAI(title)
  ]);
  
  console.log('📊 Perplexity result:', perplexityResult ? JSON.stringify(perplexityResult).slice(0, 100) : 'unavailable');
  console.log('📊 Lovable AI result:', lovableResult ? JSON.stringify(lovableResult).slice(0, 100) : 'unavailable');
  
  // If either source is unavailable, don't auto-resolve
  if (!perplexityResult || !lovableResult) {
    console.log('⚠️ One or more sources unavailable - blocking auto-resolution');
    return { resolved: false };
  }
  
  // If either says not resolved, don't resolve
  if (!perplexityResult.resolved || !lovableResult.resolved) {
    console.log('⚠️ Sources indicate event not yet resolved');
    return { resolved: false };
  }
  
  // CRITICAL: Both sources must AGREE on the outcome
  if (perplexityResult.outcome !== lovableResult.outcome) {
    console.warn(`🚨 DISAGREEMENT! Perplexity: ${perplexityResult.outcome}, Lovable AI: ${lovableResult.outcome}`);
    console.warn(`🚨 BLOCKING AUTO-RESOLUTION - requires manual admin review`);
    return { resolved: false };
  }
  
  // Both agree - safe to resolve
  const outcome = perplexityResult.outcome as 'yes' | 'no';
  const sourceInfo = perplexityResult.citations?.length 
    ? ` (Sources: ${perplexityResult.citations.slice(0, 2).join(', ')})`
    : '';
  
  console.log(`✅ VERIFIED by both Perplexity + Lovable AI: ${outcome.toUpperCase()}`);
  
  return {
    resolved: true,
    outcome,
    reason: `${perplexityResult.reason}${sourceInfo} [Verified by: Perplexity + Lovable AI]`,
    currentValue: 'Multi-Source Verified'
  };
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
  console.log(`💰 Processing payouts for prediction ${predictionId}, winning position: ${winningPosition}`);
  
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
  
  console.log(`📊 Pool stats - Total: ${totalPool}, Winning (${winningPosition}): ${winningPool}`);
  
  if (totalPool === 0) {
    console.log('No bets placed, skipping payouts');
    return;
  }
  
  // Get all confirmed bets for this prediction
  const { data: allBets, error: betsError } = await supabase
    .from('bets')
    .select('id, user_id, amount, position')
    .eq('prediction_id', predictionId)
    .eq('status', 'confirmed');
  
  if (betsError) {
    console.error('Failed to fetch bets:', betsError);
    return;
  }
  
  const winningBets = allBets?.filter((b: any) => b.position === winningPosition) || [];
  const losingBets = allBets?.filter((b: any) => b.position !== winningPosition) || [];
  
  console.log(`Found ${winningBets.length} winning bets, ${losingBets.length} losing bets`);
  
  if (!winningBets.length) {
    console.log('No winning bets found');
    // Still mark losing bets as lost
    if (losingBets.length > 0) {
      await supabase
        .from('bets')
        .update({ status: 'lost', payout_amount: 0 })
        .eq('prediction_id', predictionId)
        .eq('status', 'confirmed');
    }
    return;
  }
  
  // Calculate and update each winning bet with payout_amount
  const payoutUpdates: { id: string; payout: number }[] = [];
  
  for (const bet of winningBets) {
    // Parimutuel calculation: (bet_amount / winning_pool) * total_pool
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : bet.amount;
    payoutUpdates.push({ id: bet.id, payout });
    
    console.log(`📝 Bet ${bet.id}: amount=${bet.amount}, calculated payout=${payout} sats`);
    
    // Update bet with status AND payout_amount in a single call
    const { error: updateError } = await supabase
      .from('bets')
      .update({ status: 'won', payout_amount: payout })
      .eq('id', bet.id);
    
    if (updateError) {
      console.error(`❌ Failed to update bet ${bet.id}:`, updateError);
    } else {
      console.log(`✅ Updated bet ${bet.id} with payout_amount=${payout}`);
    }
  }
  
  // Mark losing bets
  const losingPosition = winningPosition === 'yes' ? 'no' : 'yes';
  const { error: loseError } = await supabase
    .from('bets')
    .update({ status: 'lost', payout_amount: 0 })
    .eq('prediction_id', predictionId)
    .eq('position', losingPosition)
    .eq('status', 'confirmed');
  
  if (loseError) {
    console.error('Failed to mark losing bets:', loseError);
  }
  
  console.log(`✅ Payouts calculated for "${prediction.title}"`);

  // CRITICAL: Verify payout_amount is set before calling send-payouts
  // Wait a moment for DB consistency
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify at least one winning bet has payout_amount set
  const { data: verifyBets, error: verifyError } = await supabase
    .from('bets')
    .select('id, payout_amount, status')
    .eq('prediction_id', predictionId)
    .eq('status', 'won');
  
  if (verifyError) {
    console.error('Verification query failed:', verifyError);
    return;
  }
  
  const betsWithPayout = verifyBets?.filter((b: any) => b.payout_amount && b.payout_amount > 0) || [];
  
  if (betsWithPayout.length === 0) {
    console.error('❌ CRITICAL: No bets have payout_amount set! Attempting retry...');
    
    // Retry setting payout_amount for each bet
    for (const update of payoutUpdates) {
      const { error: retryError } = await supabase
        .from('bets')
        .update({ payout_amount: update.payout })
        .eq('id', update.id);
      
      if (retryError) {
        console.error(`Retry failed for bet ${update.id}:`, retryError);
      } else {
        console.log(`✅ Retry successful for bet ${update.id}`);
      }
    }
    
    // Wait again and re-verify
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: reVerify } = await supabase
      .from('bets')
      .select('id, payout_amount')
      .eq('prediction_id', predictionId)
      .eq('status', 'won')
      .not('payout_amount', 'is', null);
    
    if (!reVerify?.length) {
      console.error('❌ FATAL: Could not set payout_amount after retry. Aborting payout trigger.');
      return;
    }
  }
  
  console.log(`✅ Verified ${betsWithPayout.length || 'retry'} bets have payout_amount set`);

  // Automatically trigger payout distribution
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing env vars for payout trigger');
    return;
  }
  
  // Call send-payouts to distribute winnings
  const payoutUrl = `${supabaseUrl}/functions/v1/send-payouts`;
  
  console.log(`🚀 Triggering send-payouts for prediction ${predictionId}...`);
  
  try {
    const payoutResponse = await fetch(payoutUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ prediction_id: predictionId })
    });

    if (!payoutResponse.ok) {
      const errorText = await payoutResponse.text();
      console.error(`❌ Payout call failed: ${payoutResponse.status} - ${errorText}`);
    } else {
      const result = await payoutResponse.json();
      console.log(`✅ Payout triggered successfully:`, JSON.stringify(result));
    }
  } catch (payoutError) {
    console.error('❌ Payout trigger fetch error:', payoutError);
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
      
      // Check if this is an NFL/sports prediction that needs a time buffer
      const isNFLPrediction = 
        pred.category === 'sports' ||
        ['nfl', 'super bowl', 'playoff', 'patriots', 'eagles', 'chiefs', 'packers', 'bears', 
         'rams', 'cowboys', 'bills', 'ravens', '49ers', 'lions', 'vikings', 'jaguars',
         'chargers', 'broncos', 'raiders', 'dolphins', 'jets', 'bengals', 'browns',
         'texans', 'colts', 'titans', 'falcons', 'saints', 'buccaneers', 'cardinals',
         'seahawks', 'giants', 'commanders', 'steelers', 'panthers']
          .some(team => titleLower.includes(team));
      
      // For NFL/sports predictions, require at least 3 hours after end_date
      // This ensures the game has actually finished before we try to resolve
      if (isNFLPrediction) {
        const endDate = new Date(pred.end_date);
        const now = new Date();
        const hoursSinceEnd = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceEnd < 3) {
          console.log(`⏳ Skipping NFL prediction (only ${hoursSinceEnd.toFixed(1)}h since end_date, waiting for 3h buffer): ${pred.title.slice(0, 50)}`);
          continue;
        }
        console.log(`✅ NFL prediction passed 3h buffer (${hoursSinceEnd.toFixed(1)}h since end): ${pred.title.slice(0, 50)}`);
      }
      
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

        const baseDescription = (pred.description || '').trim();
        const oracleStamp = (
          [
            '---',
            `Oracle resolution: ${winningPosition.toUpperCase()}`,
            `Source: ${source}`,
            oracleResult.reason ? `Evidence: ${oracleResult.reason}` : undefined,
          ] as Array<string | undefined>
        )
          .filter((line): line is string => Boolean(line))
          .join('\n');

        await supabase
          .from('predictions')
          .update({
            status,
            resolved_at: new Date().toISOString(),
            description: `${baseDescription}${baseDescription ? '\n\n' : ''}${oracleStamp}`,
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