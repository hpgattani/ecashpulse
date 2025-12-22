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

  // Handle "Up or Down" predictions - use both CoinGecko + Perplexity
  if (titleLower.includes('up or down') || titleLower.includes('up/down')) {
    console.log(`📊 Checking ${coinName} up/down with CoinGecko + Perplexity...`);
    
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
          const isUp = priceChange24h >= 0;
          // For "Up or Down" - YES means UP, NO means DOWN
          return {
            resolved: true,
            outcome: isUp ? 'yes' : 'no',
            reason: `${coinName} 24h change: ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}% (CoinGecko). Current: $${price.toLocaleString()}`,
            currentValue: `$${price.toLocaleString()} (${priceChange24h >= 0 ? '↑' : '↓'}${Math.abs(priceChange24h).toFixed(2)}%)`
          };
        }
      }
    } catch (error) {
      console.error('CoinGecko detailed API error:', error);
    }
    
    // Fallback to Perplexity for up/down verification
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (perplexityKey) {
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
                content: 'You verify crypto price movements. Return ONLY valid JSON.'
              },
              { 
                role: 'user', 
                content: `Is ${coinName} price UP or DOWN today (${new Date().toISOString().split('T')[0]})? Current price: $${price}. Return JSON: {"direction": "up" or "down", "reason": "brief explanation with percentage change"}` 
              }
            ],
            search_recency_filter: 'day',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          let cleaned = content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
          try {
            const result = JSON.parse(cleaned);
            if (result.direction) {
              const isUp = result.direction.toLowerCase() === 'up';
              return {
                resolved: true,
                outcome: isUp ? 'yes' : 'no',
                reason: `${coinName} is ${result.direction.toUpperCase()} - ${result.reason} (Perplexity + CoinGecko: $${price.toLocaleString()})`,
                currentValue: `$${price.toLocaleString()}`
              };
            }
          } catch (e) {
            console.log('Perplexity parse error for up/down:', e);
          }
        }
      } catch (error) {
        console.error('Perplexity up/down check error:', error);
      }
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
      // 5. All other categories - use Perplexity real-time web search
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