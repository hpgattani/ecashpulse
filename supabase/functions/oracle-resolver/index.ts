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
      reason: `${coinName} price: $${price.toLocaleString()} (target: $${targetPrice.toLocaleString()})`,
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

// TheSportsDB API (free, no key required for basic queries)
async function checkSportsResult(title: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  try {
    // Super Bowl predictions
    if (titleLower.includes('super bowl')) {
      const teamMatch = title.match(/(?:chiefs|eagles|49ers|ravens|bills|cowboys|packers|lions)/i);
      if (teamMatch) {
        const team = teamMatch[0].toLowerCase();
        // Query TheSportsDB for NFL events
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

    // World Series / MLB
    if (titleLower.includes('world series') || titleLower.includes('mlb')) {
      const response = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=World_Series`
      );
      if (response.ok) {
        const data = await response.json();
        // Process MLB results
      }
    }

    // Premier League / Soccer
    if (titleLower.includes('premier league') || titleLower.includes('champions league')) {
      const teamMatch = title.match(/(?:manchester|liverpool|chelsea|arsenal|tottenham|city)/i);
      if (teamMatch) {
        const team = teamMatch[0].toLowerCase();
        const response = await fetch(
          `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${team}`
        );
        if (response.ok) {
          const data = await response.json();
          // Process team results
        }
      }
    }

  } catch (error) {
    console.error('Sports API error:', error);
  }
  
  return { resolved: false };
}

// ==================== NEWS/EVENTS ORACLES ====================

// DISABLED: AI oracle is unreliable for real-time events - can have outdated training data
// All non-API-verifiable predictions require manual admin resolution via resolve-prediction endpoint
async function checkNewsEvent(title: string, supabase: any): Promise<OracleResult> {
  // Do NOT auto-resolve using AI - it can hallucinate or use outdated data
  // Real events (IPL auctions, elections, awards, etc.) must be manually verified by admins
  console.log(`⚠️ Skipping AI resolution for: "${title.slice(0, 60)}" - requires manual admin verification`);
  return { resolved: false, reason: 'Requires manual admin verification' };
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

  // Automatically send payments to winners
  try {
    console.log('Triggering automatic payment distribution...');
    const payoutResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ prediction_id: predictionId })
    });

    if (payoutResponse.ok) {
      const payoutResult = await payoutResponse.json();
      console.log(`Automatic payments: ${JSON.stringify(payoutResult)}`);
    } else {
      const error = await payoutResponse.text();
      console.error(`Automatic payment failed: ${error}`);
    }
  } catch (error) {
    console.error('Error triggering automatic payments:', error);
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
      
      // 1. Check for flippening predictions first
      if (titleLower.includes('flippen') || 
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
      // 3. Sports predictions
      else if (pred.category === 'sports' ||
               ['super bowl', 'world series', 'wimbledon', 'premier league', 'nba', 'nfl', 'champions league']
                 .some(s => titleLower.includes(s))) {
        oracleResult = await checkSportsResult(pred.title);
        source = 'TheSportsDB';
      }
      // 4. Entertainment predictions
      else if (pred.category === 'entertainment' ||
               ['oscar', 'grammy', 'emmy', 'movie', 'album', 'netflix', 'disney']
                 .some(e => titleLower.includes(e))) {
        oracleResult = await checkEntertainmentEvent(pred.title);
        source = 'Entertainment Oracle';
      }
      // 5. Politics, tech, and other categories - require manual admin resolution
      // These cannot be auto-resolved as AI may have outdated or incorrect data
      else if (pred.category === 'politics' || pred.category === 'tech' ||
               ['election', 'president', 'congress', 'senate', 'vote', 'apple', 'google', 'openai', 'tesla', 'ipl', 'auction']
                 .some(p => titleLower.includes(p))) {
        console.log(`⏳ "${pred.title.slice(0, 50)}" requires manual admin resolution`);
        source = 'Manual Admin Required';
      }
      
      // No AI fallback - unresolved predictions stay unresolved until admin manually resolves them
      // This prevents incorrect auto-resolutions from outdated or hallucinated AI data
      
      if (oracleResult.resolved && oracleResult.outcome) {
        const status = oracleResult.outcome === 'yes' ? 'resolved_yes' : 'resolved_no';
        
        await supabase
          .from('predictions')
          .update({ 
            status, 
            resolved_at: new Date().toISOString(),
            description: `${pred.description || ''}\n\n🔮 Oracle Resolution (${source}): ${oracleResult.reason}`
          })
          .eq('id', pred.id);
        
        await processPayouts(supabase, pred.id, oracleResult.outcome);
        
        results.push({
          id: pred.id,
          title: pred.title,
          outcome: oracleResult.outcome,
          reason: oracleResult.reason || 'Oracle verified',
          source
        });
        
        console.log(`✓ Resolved: ${pred.title.slice(0, 50)} -> ${oracleResult.outcome} (${source})`);
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