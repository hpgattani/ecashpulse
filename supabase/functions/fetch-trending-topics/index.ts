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
  }
  
  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
}

// Fetch markets from Polymarket API
async function fetchPolymarketData(): Promise<Array<{ title: string; description: string; category: string; endDate?: string }>> {
  try {
    // Polymarket CLOB API for active markets
    const response = await fetch('https://clob.polymarket.com/markets?active=true&limit=20', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.log('Polymarket API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    const markets: Array<{ title: string; description: string; category: string; endDate?: string }> = [];
    
    for (const market of (data || []).slice(0, 10)) {
      if (market.question && market.active) {
        // Categorize based on keywords
        let category = 'politics';
        const q = market.question.toLowerCase();
        if (q.includes('bitcoin') || q.includes('eth') || q.includes('crypto') || q.includes('token')) category = 'crypto';
        else if (q.includes('sports') || q.includes('nfl') || q.includes('nba') || q.includes('match') || q.includes('win')) category = 'sports';
        else if (q.includes('ai') || q.includes('tech') || q.includes('apple') || q.includes('google')) category = 'tech';
        else if (q.includes('movie') || q.includes('oscar') || q.includes('grammy')) category = 'entertainment';
        else if (q.includes('fed') || q.includes('rate') || q.includes('gdp') || q.includes('inflation')) category = 'economics';
        
        markets.push({
          title: market.question.slice(0, 200),
          description: market.description?.slice(0, 500) || `Polymarket: ${market.question}`,
          category,
          endDate: market.end_date_iso
        });
      }
    }
    
    console.log(`Fetched ${markets.length} markets from Polymarket`);
    return markets;
  } catch (error) {
    console.error('Polymarket fetch error:', error);
    return [];
  }
}

// Fetch from Kalshi API (public markets endpoint)
async function fetchKalshiData(): Promise<Array<{ title: string; description: string; category: string; endDate?: string }>> {
  try {
    const response = await fetch('https://trading-api.kalshi.com/trade-api/v2/markets?limit=20&status=open', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.log('Kalshi API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    const markets: Array<{ title: string; description: string; category: string; endDate?: string }> = [];
    
    for (const market of (data.markets || []).slice(0, 10)) {
      if (market.title && market.status === 'open') {
        let category = 'politics';
        const t = market.title.toLowerCase();
        if (t.includes('bitcoin') || t.includes('crypto') || t.includes('eth')) category = 'crypto';
        else if (t.includes('sports') || t.includes('game') || t.includes('match')) category = 'sports';
        else if (t.includes('tech') || t.includes('ai') || t.includes('company')) category = 'tech';
        else if (t.includes('fed') || t.includes('rate') || t.includes('economic')) category = 'economics';
        
        markets.push({
          title: market.title.slice(0, 200),
          description: market.subtitle?.slice(0, 500) || market.title,
          category,
          endDate: market.close_time
        });
      }
    }
    
    console.log(`Fetched ${markets.length} markets from Kalshi`);
    return markets;
  } catch (error) {
    console.error('Kalshi fetch error:', error);
    return [];
  }
}

// Generate AI predictions for sports/trending topics
async function generateAIPredictions(): Promise<Array<{ title: string; description: string; category: string }>> {
  const prompt = `Generate 5 timely prediction market questions for betting. Focus on:
- Live sports: Cricket (IPL, international), Football (Premier League, Champions League), Tennis, NBA, NFL
- Crypto prices: Bitcoin, Ethereum, Solana, XRP milestones
- Politics: Elections, policy decisions
- Entertainment: Award shows, movie releases

Current date: ${new Date().toISOString().split('T')[0]}

Format as JSON array:
[{"title": "Will...", "description": "...", "category": "sports|crypto|politics|entertainment|economics|tech"}]`;

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
          { role: 'system', content: 'You are a prediction market analyst. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) return [];
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('AI generation error:', error);
    return [];
  }
}

// Payout winners for resolved predictions
async function processPayouts(supabase: any, predictionId: string, winningPosition: 'yes' | 'no'): Promise<void> {
  console.log(`Processing payouts for prediction ${predictionId}, winning: ${winningPosition}`);
  
  // Get the prediction pools
  const { data: prediction } = await supabase
    .from('predictions')
    .select('yes_pool, no_pool, title')
    .eq('id', predictionId)
    .single();
  
  if (!prediction) {
    console.error('Prediction not found');
    return;
  }
  
  const totalPool = prediction.yes_pool + prediction.no_pool;
  const winningPool = winningPosition === 'yes' ? prediction.yes_pool : prediction.no_pool;
  
  // Get all winning bets
  const { data: winningBets } = await supabase
    .from('bets')
    .select('id, user_id, amount, position')
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition)
    .eq('status', 'confirmed');
  
  if (!winningBets || winningBets.length === 0) {
    console.log('No winning bets found');
    return;
  }
  
  console.log(`Found ${winningBets.length} winning bets`);
  
  // Calculate and record payouts for each winner
  for (const bet of winningBets) {
    // Proportional payout: (bet amount / winning pool) * total pool
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : bet.amount;
    
    // Update bet with payout info
    await supabase
      .from('bets')
      .update({
        status: 'won',
        payout_amount: payout
      })
      .eq('id', bet.id);
    
    // Update user profile stats
    await supabase
      .from('profiles')
      .update({
        total_wins: supabase.sql`total_wins + 1`,
        total_volume: supabase.sql`total_volume + ${payout}`
      })
      .eq('user_id', bet.user_id);
    
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

// Main fetch and sync function
async function syncPredictions(supabase: any): Promise<{ created: number; resolved: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let resolved = 0;

  // Fetch from multiple sources in parallel
  const [polymarketMarkets, kalshiMarkets, aiPredictions] = await Promise.all([
    fetchPolymarketData(),
    fetchKalshiData(),
    generateAIPredictions()
  ]);
  
  const allMarkets = [...polymarketMarkets, ...kalshiMarkets, ...aiPredictions];
  console.log(`Total markets fetched: ${allMarkets.length}`);

  // Get existing predictions to avoid duplicates
  const { data: existingPredictions } = await supabase
    .from('predictions')
    .select('title')
    .eq('status', 'active');
  
  const existingTitles = new Set((existingPredictions || []).map((p: any) => p.title.toLowerCase().slice(0, 50)));

  // Insert new predictions
  for (const market of allMarkets) {
    if (!market.title) continue;
    
    // Check for duplicates using first 50 chars
    const titleKey = market.title.toLowerCase().slice(0, 50);
    if (existingTitles.has(titleKey)) continue;
    
    const category = CATEGORIES.includes(market.category as any) ? market.category : 'politics';
    
    // Get end date from market data if available
    const marketWithDate = market as { title: string; description: string; category: string; endDate?: string };
    
    const newPrediction = {
      title: market.title.slice(0, 200),
      description: (market.description || '').slice(0, 500),
      category,
      escrow_address: generateEscrowAddress(),
      end_date: marketWithDate.endDate || calculateEndDate(category),
      status: 'active',
      yes_pool: 0,
      no_pool: 0,
    };

    const { error } = await supabase.from('predictions').insert(newPrediction);
    
    if (error) {
      errors.push(`Insert failed: ${market.title.slice(0, 50)}`);
    } else {
      existingTitles.add(titleKey);
      created++;
      console.log('Created:', newPrediction.title);
    }
  }

  // Auto-resolve expired predictions (check for any that need resolution)
  const { data: expiredPredictions } = await supabase
    .from('predictions')
    .select('id, title, yes_pool, no_pool')
    .eq('status', 'active')
    .lt('end_date', new Date().toISOString());
  
  for (const pred of (expiredPredictions || [])) {
    // Auto-resolve based on pool majority (simple oracle)
    const winningPosition = pred.yes_pool >= pred.no_pool ? 'yes' : 'no';
    const status = winningPosition === 'yes' ? 'resolved_yes' : 'resolved_no';
    
    await supabase
      .from('predictions')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', pred.id);
    
    // Process payouts
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

  // Allow public access - this runs automatically
  // Can be triggered by cron, webhook, or manual call
  
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
