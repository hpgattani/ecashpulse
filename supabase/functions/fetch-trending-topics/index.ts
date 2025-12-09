import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = ['crypto', 'politics', 'sports', 'tech', 'entertainment', 'economics'] as const;

function generateEscrowAddress(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let address = 'ecash:qp';
  for (let i = 0; i < 38; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

function calculateEndDate(category: string, daysHint?: number): string {
  const now = new Date();
  let daysToAdd = daysHint || 30;
  
  if (!daysHint) {
    if (category === 'sports') daysToAdd = 7;
    if (category === 'politics') daysToAdd = 90;
    if (category === 'crypto') daysToAdd = 14;
    if (category === 'tech') daysToAdd = 60;
  }
  
  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
}

// Improved category detection with more keywords
function detectCategory(question: string): string {
  const q = question.toLowerCase();
  
  // Crypto keywords (check first as these are most specific)
  if (q.includes('bitcoin') || q.includes('btc') || q.includes('ethereum') || q.includes('eth') || 
      q.includes('solana') || q.includes('sol') || q.includes('xrp') || q.includes('ripple') ||
      q.includes('cardano') || q.includes('ada') || q.includes('dogecoin') || q.includes('doge') ||
      q.includes('crypto') || q.includes('token') || q.includes('defi') || q.includes('nft') ||
      q.includes('market cap') || q.includes('ecash') || q.includes('xec')) {
    return 'crypto';
  }
  
  // Sports keywords
  if (q.includes('nfl') || q.includes('nba') || q.includes('nhl') || q.includes('mlb') ||
      q.includes('super bowl') || q.includes('world series') || q.includes('world cup') ||
      q.includes('championship') || q.includes('champions league') || q.includes('premier league') ||
      q.includes('wimbledon') || q.includes('tennis') || q.includes('football') || q.includes('basketball') ||
      q.includes('hockey') || q.includes('baseball') || q.includes('cricket') || q.includes('ipl') ||
      q.includes('olympics') || q.includes('ufc') || q.includes('boxing') || q.includes('f1') ||
      q.includes('formula 1') || q.includes('grand prix')) {
    return 'sports';
  }
  
  // Tech keywords (check before politics since tech companies often appear in political context)
  if (q.includes('apple') || q.includes('google') || q.includes('microsoft') || q.includes('amazon') ||
      q.includes('nvidia') || q.includes('openai') || q.includes('gpt') || q.includes('ai ') ||
      q.includes('artificial intelligence') || q.includes('chatgpt') || q.includes('deepmind') ||
      q.includes('tesla') || q.includes('spacex') || q.includes('iphone') || q.includes('android') ||
      q.includes('ar/vr') || q.includes('virtual reality') || q.includes('augmented reality') ||
      q.includes('robot') || q.includes('quantum') || q.includes('semiconductor') || q.includes('chip')) {
    return 'tech';
  }
  
  // Entertainment keywords
  if (q.includes('oscar') || q.includes('grammy') || q.includes('emmy') || q.includes('golden globe') ||
      q.includes('movie') || q.includes('film') || q.includes('album') || q.includes('spotify') ||
      q.includes('netflix') || q.includes('disney') || q.includes('celebrity') || q.includes('concert') ||
      q.includes('tour') || q.includes('box office') || q.includes('streaming') || q.includes('youtube') ||
      q.includes('tiktok') || q.includes('twitter') || q.includes('elon musk') && q.includes('tweet')) {
    return 'entertainment';
  }
  
  // Economics keywords
  if (q.includes('fed') || q.includes('interest rate') || q.includes('inflation') || q.includes('gdp') ||
      q.includes('recession') || q.includes('stock market') || q.includes('s&p') || q.includes('dow') ||
      q.includes('nasdaq') || q.includes('unemployment') || q.includes('economy') || q.includes('fiscal')) {
    return 'economics';
  }
  
  // Default to politics for elections, legislation, etc.
  return 'politics';
}

// Fetch markets from Polymarket Gamma API with odds
async function fetchPolymarketData(): Promise<Array<{ title: string; description: string; category: string; endDate?: string; yesOdds?: number; noOdds?: number }>> {
  try {
    // Use Polymarket's public gamma API
    const response = await fetch('https://gamma-api.polymarket.com/markets?limit=50&active=true', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.log('Polymarket Gamma API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    const markets: Array<{ title: string; description: string; category: string; endDate?: string; yesOdds?: number; noOdds?: number }> = [];
    
    // Gamma API returns array directly
    const marketList = Array.isArray(data) ? data : (data.markets || data.data || []);
    
    for (const market of marketList.slice(0, 25)) {
      const question = market.question || market.title || market.name;
      if (!question) continue;
      
      // Use improved category detection
      const category = detectCategory(question);
      
      // Extract odds from outcome prices if available
      let yesOdds = 50;
      let noOdds = 50;
      
      if (market.outcomePrices) {
        try {
          const prices = typeof market.outcomePrices === 'string' 
            ? JSON.parse(market.outcomePrices) 
            : market.outcomePrices;
          if (Array.isArray(prices) && prices.length >= 2) {
            yesOdds = Math.round(parseFloat(prices[0]) * 100);
            noOdds = Math.round(parseFloat(prices[1]) * 100);
          }
        } catch (e) {
          console.log('Error parsing outcome prices:', e);
        }
      } else if (market.bestBid !== undefined && market.bestAsk !== undefined) {
        // Use bid/ask as a proxy for odds
        const midPrice = (parseFloat(market.bestBid) + parseFloat(market.bestAsk)) / 2;
        yesOdds = Math.round(midPrice * 100);
        noOdds = 100 - yesOdds;
      }
      
      markets.push({
        title: question.slice(0, 200),
        description: (market.description || `Polymarket: ${question}`).slice(0, 500),
        category,
        endDate: market.endDate || market.end_date || market.close_time,
        yesOdds,
        noOdds
      });
    }
    
    console.log(`Fetched ${markets.length} markets from Polymarket`);
    return markets;
  } catch (error) {
    console.error('Polymarket fetch error:', error);
    return [];
  }
}

// Generate AI predictions with fact-checking
async function generateAIPredictions(): Promise<Array<{ title: string; description: string; category: string; endDate?: string }>> {
  const today = new Date().toISOString().split('T')[0];
  
  const prompt = `You are creating prediction market questions for a betting platform. Today is ${today}.

CRITICAL RULES:
1. Only create predictions about FUTURE events that have NOT happened yet
2. DO NOT include any events that have already occurred or been resolved
3. End dates must be in the future (after ${today})
4. Be specific with dates and measurable outcomes
5. IMPORTANT: Assign CORRECT categories:
   - crypto: Bitcoin, Ethereum, Solana, XRP, market cap, DeFi, tokens
   - tech: Apple, Google, Microsoft, AI, gadgets, software, robots
   - sports: NFL, NBA, FIFA, Olympics, championships, matches
   - politics: Elections, legislation, government, policy
   - entertainment: Movies, music, awards, celebrities, streaming

Generate exactly 8 prediction market questions across these categories:
- CRYPTO (2): Price targets for BTC, ETH, SOL, XEC with specific dates
- TECH (2): Product launches, company milestones, AI developments
- SPORTS (2): Upcoming matches, tournaments, championships
- ENTERTAINMENT/POLITICS (2): Award shows, elections, policy decisions

Format as JSON array ONLY:
[
  {"title": "Will Bitcoin trade above $150,000 before March 1, 2026?", "description": "BTC/USD price reaching $150k on major exchanges", "category": "crypto", "endDate": "2026-03-01"},
  {"title": "Will OpenAI release GPT-5 before June 2026?", "description": "Official public release of GPT-5 model", "category": "tech", "endDate": "2026-06-30"}
]`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a prediction market analyst. Return ONLY valid JSON array. Only include predictions about future events that have NOT happened. Verify dates are in the future.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      console.log('AI API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    cleaned = cleaned.trim();
    
    const predictions = JSON.parse(cleaned);
    
    // Filter out any predictions with past end dates and fix categories
    const now = new Date();
    const validPredictions = predictions
      .filter((p: any) => {
        if (p.endDate) {
          const endDate = new Date(p.endDate);
          return endDate > now;
        }
        return true;
      })
      .map((p: any) => ({
        ...p,
        category: detectCategory(p.title) // Re-verify category
      }));
    
    console.log(`AI generated ${validPredictions.length} valid predictions`);
    return validPredictions;
  } catch (error) {
    console.error('AI generation error:', error);
    return [];
  }
}

// Payout winners for resolved predictions
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
  
  const { data: winningBets } = await supabase
    .from('bets')
    .select('id, user_id, amount')
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition)
    .eq('status', 'confirmed');
  
  if (!winningBets?.length) return;
  
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
}

// Main sync function
async function syncPredictions(supabase: any): Promise<{ created: number; resolved: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let resolved = 0;

  // Fetch from sources in parallel
  const [polymarketMarkets, aiPredictions] = await Promise.all([
    fetchPolymarketData(),
    generateAIPredictions()
  ]);
  
  const allMarkets = [...polymarketMarkets, ...aiPredictions];
  console.log(`Total markets fetched: ${allMarkets.length}`);

  // Get existing predictions
  const { data: existingPredictions } = await supabase
    .from('predictions')
    .select('title')
    .eq('status', 'active');
  
  const existingTitles = new Set((existingPredictions || []).map((p: any) => p.title.toLowerCase().slice(0, 50)));

  // Insert new predictions
  for (const market of allMarkets) {
    if (!market.title) continue;
    
    const titleKey = market.title.toLowerCase().slice(0, 50);
    if (existingTitles.has(titleKey)) continue;
    
    const category = CATEGORIES.includes(market.category as any) ? market.category : 'politics';
    const marketWithDate = market as { title: string; description: string; category: string; endDate?: string };
    
    // Calculate initial pools from odds if available
    const marketWithOdds = market as { yesOdds?: number; noOdds?: number };
    const yesPool = marketWithOdds.yesOdds ? marketWithOdds.yesOdds * 100 : 0;
    const noPool = marketWithOdds.noOdds ? marketWithOdds.noOdds * 100 : 0;
    
    const newPrediction = {
      title: market.title.slice(0, 200),
      description: (market.description || '').slice(0, 500),
      category,
      escrow_address: generateEscrowAddress(),
      end_date: marketWithDate.endDate || calculateEndDate(category),
      status: 'active',
      yes_pool: yesPool,
      no_pool: noPool,
    };

    const { error } = await supabase.from('predictions').insert(newPrediction);
    
    if (error) {
      errors.push(`Insert failed: ${market.title.slice(0, 50)}`);
    } else {
      existingTitles.add(titleKey);
      created++;
      console.log('Created:', newPrediction.title.slice(0, 60));
    }
  }

  // Auto-resolve expired predictions
  const { data: expiredPredictions } = await supabase
    .from('predictions')
    .select('id, title, yes_pool, no_pool')
    .eq('status', 'active')
    .lt('end_date', new Date().toISOString());
  
  for (const pred of (expiredPredictions || [])) {
    const winningPosition = pred.yes_pool >= pred.no_pool ? 'yes' : 'no';
    const status = winningPosition === 'yes' ? 'resolved_yes' : 'resolved_no';
    
    await supabase
      .from('predictions')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', pred.id);
    
    await processPayouts(supabase, pred.id, winningPosition);
    
    resolved++;
    console.log(`Auto-resolved: ${pred.title} -> ${winningPosition}`);
  }

  return { created, resolved, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Starting automatic prediction sync...');
    const result = await syncPredictions(supabase);
    console.log(`Sync complete: ${result.created} created, ${result.resolved} resolved`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: result.created,
        resolved: result.resolved,
        errors: result.errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Sync failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
