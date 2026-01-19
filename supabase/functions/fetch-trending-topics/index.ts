import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORIES = ['crypto', 'politics', 'sports', 'tech', 'entertainment', 'economics'] as const;

type Category = typeof CATEGORIES[number];

// Guardrails to prevent low-quality / stale auto-generated markets.
// - Maximum horizon avoids far-future hype markets
// - Blocked keywords prevent AI/product-release hype (e.g., GPT/OpenAI)
// NOTE: We removed AUTO_MIN_END_DAYS because short-term bets are valid
const AUTO_MAX_END_DAYS_BY_CATEGORY: Record<Category, number> = {
  crypto: 120,
  politics: 365,
  sports: 90,
  tech: 90,
  entertainment: 120,
  economics: 180,
};

const AUTO_BLOCKED_TITLE_KEYWORDS = [
  'openai',
  'gpt',
  'chatgpt',
  'anthropic',
  'claude',
  'gemini',
  'deepmind',
  // Block COVID/pandemic related predictions - outdated topic
  'covid',
  'covid-19',
  'coronavirus',
  'pandemic',
  'lockdown',
  'vaccine mandate',
  // Block retired fighters/athletes
  'khabib',
  'nurmagomedov',
  'ufc 254',
  // Block repetitive/spam predictions
  'dharma',
  'retroactive uni distribution',
  'uni distribution proposal',
  'price range',
  // Block vague multi-option price predictions (should be multibets)
  'what price will',
  'what day will',
  '2nd largest',
  'second largest',
  '3rd largest',
  'third largest',
  'largest company by market cap',
  'market cap ranking',
];

// Patterns that are obviously trivially-true or nonsense (e.g., "American team win Super Bowl")
const TRIVIALLY_TRUE_PATTERNS: RegExp[] = [
  /american team.*(win|super bowl)/i,
  /nfl team.*(win|super bowl)/i,
];

// Keywords that belong to a specific category - reject if detected category doesn't match
const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  economics: ['inflation', 'gdp', 'interest rate', 'unemployment', 'recession', 'cpi', 'fed rate'],
  // Include athlete names + tennis tour terms to prevent "Serena Williams" being misrouted.
  sports: [
    'nfl', 'nba', 'mlb', 'nhl', 'super bowl', 'playoffs', 'championship', 'ipl', 'cricket', 'world cup',
    'tennis', 'wimbledon', 'us open', 'australian open', 'french open', 'roland garros', 'grand slam',
    'atp', 'wta', 'serena williams'
  ],
  crypto: ['bitcoin', 'ethereum', 'btc', 'eth', 'token', 'blockchain', 'lighter'],
  politics: ['election', 'president', 'congress', 'senate', 'vote'],
};

function isMiscategorized(title: string, detectedCategory: string): boolean {
  const t = title.toLowerCase();
  for (const [correctCategory, keywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
    if (correctCategory === detectedCategory) continue;
    for (const kw of keywords) {
      if (t.includes(kw)) {
        // Title has a keyword belonging to a different category
        return true;
      }
    }
  }
  return false;
}

function shouldBlockAutoMarket(title: string, category?: string): boolean {
  const t = title.toLowerCase();
  // Block AI/tech hype keywords
  if (AUTO_BLOCKED_TITLE_KEYWORDS.some((k) => t.includes(k))) return true;
  // Block trivially true patterns
  if (TRIVIALLY_TRUE_PATTERNS.some((p) => p.test(t))) return true;
  // Block miscategorized markets (e.g., inflation question in sports)
  if (category && isMiscategorized(t, category)) return true;
  return false;
}

// Extract date from title like "December 29" or "December 22-28" and return proper end date
function extractDateFromTitle(title: string): Date | null {
  const t = title.toLowerCase();
  const currentYear = new Date().getFullYear();
  
  // Month mapping
  const months: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
  };
  
  // Try to match patterns like "December 29", "Dec 22-28", "by December 31"
  for (const [monthName, monthIndex] of Object.entries(months)) {
    // Match "month day" or "month day-day" patterns
    const regex = new RegExp(`${monthName}\\s+(\\d{1,2})(?:-(\\d{1,2}))?`, 'i');
    const match = t.match(regex);
    if (match) {
      // Use the last day if it's a range (e.g., "22-28" -> use 28)
      const day = match[2] ? parseInt(match[2]) : parseInt(match[1]);
      
      // Determine year - if the date is in the past for this year, use next year
      let year = currentYear;
      const candidateDate = new Date(year, monthIndex, day, 23, 59, 59);
      if (candidateDate < new Date()) {
        year = currentYear + 1;
      }
      
      return new Date(year, monthIndex, day, 23, 59, 59);
    }
  }
  
  return null;
}

function normalizeAutoEndDate(endDate: string | undefined, category: Category, title: string): string | null {
  const nowMs = Date.now();
  const maxMs = nowMs + AUTO_MAX_END_DAYS_BY_CATEGORY[category] * 24 * 60 * 60 * 1000;
  
  // First, try to extract date from title
  const titleDate = extractDateFromTitle(title);
  if (titleDate) {
    const titleMs = titleDate.getTime();
    // Allow past dates up to 1 day ago (for markets ending "today")
    const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
    if (titleMs >= oneDayAgo && titleMs <= maxMs) {
      return titleDate.toISOString();
    }
  }
  
  // Fallback to provided endDate
  const candidateMs = endDate ? new Date(endDate).getTime() : NaN;
  if (!Number.isFinite(candidateMs)) {
    // Default to 7 days from now if no date provided and no title date
    return new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  
  // Check against max
  if (candidateMs > maxMs) return null;
  
  return new Date(candidateMs).toISOString();
}

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
    if (category === 'sports') daysToAdd = 14;
    if (category === 'politics') daysToAdd = 90;
    if (category === 'crypto') daysToAdd = 30;
    if (category === 'tech') daysToAdd = 60;
    if (category === 'entertainment') daysToAdd = 45;
  }

  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
}

function detectCategory(question: string): string {
  const q = question.toLowerCase();

  if (
    q.includes('bitcoin') || q.includes('btc') || q.includes('ethereum') || q.includes('eth') ||
    q.includes('solana') || q.includes('sol') || q.includes('xrp') || q.includes('ripple') ||
    q.includes('cardano') || q.includes('ada') || q.includes('dogecoin') || q.includes('doge') ||
    q.includes('crypto') || q.includes('token') || q.includes('defi') || q.includes('nft') ||
    q.includes('market cap') || q.includes('ecash') || q.includes('xec') ||
    q.includes('zcash') || q.includes('zec') || q.includes('monero') || q.includes('xmr') ||
    q.includes('dash') || q.includes('kaspa') || q.includes('kas') || q.includes('hbar') ||
    q.includes('hedera') || q.includes('algorand') || q.includes('algo') || q.includes('fantom') ||
    q.includes('ftm') || q.includes('arbitrum') || q.includes('arb') || q.includes('optimism') ||
    q.includes('op token') || q.includes('sei') || q.includes('injective') || q.includes('inj') ||
    q.includes('binance') || q.includes('coinbase') || q.includes('chainlink') || q.includes('link') ||
    q.includes('polygon') || q.includes('matic') || q.includes('avalanche') || q.includes('avax') ||
    q.includes('polkadot') || q.includes('dot') || q.includes('litecoin') || q.includes('ltc') ||
    q.includes('uniswap') || q.includes('aave') || q.includes('tether') || q.includes('usdt') ||
    q.includes('usdc') || q.includes('stablecoin') || q.includes('altcoin') || q.includes('memecoin') ||
    q.includes('shiba') || q.includes('pepe') || q.includes('floki') || q.includes('bnb') ||
    q.includes('tron') || q.includes('trx') || q.includes('near') || q.includes('sui') ||
    q.includes('aptos') || q.includes('apt') || q.includes('cosmos') || q.includes('atom') ||
    q.includes('lighter') || q.includes('layer') ||
    (q.includes('price') && (q.includes('$') || q.includes('usd')))
  ) {
    return 'crypto';
  }

  if (
    q.includes('nfl') || q.includes('nba') || q.includes('nhl') || q.includes('mlb') ||
    q.includes('super bowl') || q.includes('world series') || q.includes('world cup') ||
    q.includes('championship') || q.includes('champions league') || q.includes('premier league') ||
    q.includes('wimbledon') || q.includes('tennis') || q.includes('football') || q.includes('soccer') ||
    q.includes('basketball') || q.includes('hockey') || q.includes('baseball') || q.includes('cricket') ||
    q.includes('ipl') || q.includes('olympics') || q.includes('ufc') || q.includes('boxing') ||
    q.includes('f1') || q.includes('formula 1') || q.includes('grand prix') ||
    q.includes('uefa') || q.includes('euro 20') || (q.includes('euro') && q.includes('final')) ||
    // Tennis tours + famous players
    q.includes('atp') || q.includes('wta') || q.includes('grand slam') ||
    q.includes('us open') || q.includes('australian open') || q.includes('french open') || q.includes('roland garros') ||
    q.includes('serena williams')
  ) {
    return 'sports';
  }

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

  if (
    q.includes('oscar') || q.includes('oscars') || q.includes('academy award') ||
    q.includes('grammy') || q.includes('emmy') || q.includes('golden globe') ||
    q.includes('movie') || q.includes('film') || q.includes('director') ||
    q.includes('netflix') || q.includes('disney') || q.includes('hbo') ||
    q.includes('album') || q.includes('spotify') || q.includes('youtube') || q.includes('tiktok') ||
    q.includes('tv show') || q.includes('season') || q.includes('premiere') ||
    q.includes('house of the dragon') || q.includes('game of thrones') || q.includes('stranger things') ||
    q.includes('the last of us') || q.includes('mandalorian') || q.includes('rings of power') ||
    q.includes('marvel') || q.includes('star wars') || q.includes('series finale') ||
    q.includes('streaming') || q.includes('box office') || q.includes('concert') || q.includes('tour')
  ) {
    return 'entertainment';
  }

  if (
    q.includes('fed') || q.includes('interest rate') || q.includes('inflation') || q.includes('gdp') ||
    q.includes('recession') || q.includes('stock market') || q.includes('s&p') || q.includes('dow') ||
    q.includes('nasdaq') || q.includes('unemployment') || q.includes('economy') || q.includes('fiscal') ||
    q.includes('largest company') || q.includes('market value') || q.includes('valuation') ||
    q.includes('trillion') || q.includes('billion') || q.includes('stock price') || q.includes('ipo') ||
    q.includes('earnings') || q.includes('revenue') || q.includes('profit') || q.includes('market share') ||
    q.includes('company worth') || q.includes('most valuable')
  ) {
    return 'economics';
  }

  // Default to economics for generic business/company topics, politics only for truly unclassifiable
  if (q.includes('company') || q.includes('corporation') || q.includes('business')) {
    return 'economics';
  }

  return 'politics';
}

// Fetch markets from Polymarket Gamma API
async function fetchPolymarketData(): Promise<Array<{ title: string; description: string; category: string; endDate?: string; yesOdds?: number; noOdds?: number; imageUrl?: string }>> {
  try {
    const response = await fetch('https://gamma-api.polymarket.com/markets?limit=50&active=true', {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.log('Polymarket Gamma API error:', response.status);
      return [];
    }

    const data = await response.json();
    const markets: Array<{ title: string; description: string; category: string; endDate?: string; yesOdds?: number; noOdds?: number; imageUrl?: string }> = [];

    const marketList = Array.isArray(data) ? data : (data.markets || data.data || []);

    for (const market of marketList.slice(0, 30)) {
      const question = market.question || market.title || market.name;
      if (!question) continue;

      const category = detectCategory(question);

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
        const midPrice = (parseFloat(market.bestBid) + parseFloat(market.bestAsk)) / 2;
        yesOdds = Math.round(midPrice * 100);
        noOdds = 100 - yesOdds;
      }

      // Ensure end date is in the future (at least 7 days out)
      let endDate = market.endDate || market.end_date || market.close_time;
      if (endDate) {
        const endMs = new Date(endDate).getTime();
        const minEndDate = Date.now() + 7 * 24 * 60 * 60 * 1000; // at least 7 days
        if (endMs < minEndDate) {
          endDate = new Date(minEndDate).toISOString();
        }
      }

      // Capture image URL from Polymarket (they use 'image' or 'icon' fields)
      const imageUrl = market.image || market.icon || market.imageUrl || market.thumbnail || undefined;

      markets.push({
        title: question.slice(0, 200),
        description: (market.description || `Polymarket: ${question}`).slice(0, 500),
        category,
        endDate,
        yesOdds,
        noOdds,
        imageUrl: imageUrl ? String(imageUrl).slice(0, 500) : undefined
      });
    }

    console.log(`Fetched ${markets.length} markets from Polymarket API`);
    return markets;
  } catch (error) {
    console.error('Polymarket fetch error:', error);
    return [];
  }
}

// Use Perplexity to get trending Polymarket markets
async function fetchPerplexityPolymarket(): Promise<Array<{ title: string; description: string; category: string; endDate?: string }>> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) {
    console.log('PERPLEXITY_API_KEY not set, skipping Perplexity fetch');
    return [];
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a prediction market analyst. Return ONLY valid JSON array, no markdown.'
          },
          {
            role: 'user',
            content: `Today is ${today}. Search Polymarket.com for the top 15 most popular active prediction markets right now. 
            
For each market provide:
- title: the exact question (e.g. "Will Bitcoin reach $100k before 2025?")
- description: brief context (1-2 sentences)
- category: one of crypto, politics, sports, tech, entertainment, economics
- endDate: the resolution date in YYYY-MM-DD format (must be in the future)

Return as JSON array ONLY:
[{"title":"...", "description":"...", "category":"...", "endDate":"..."}]`
          }
        ],
        search_domain_filter: ['polymarket.com'],
        search_recency_filter: 'week'
      }),
    });

    if (!response.ok) {
      console.log('Perplexity API error:', response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    cleaned = cleaned.trim();

    // Find JSON array in content
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('No JSON array found in Perplexity response');
      return [];
    }

    const predictions = JSON.parse(jsonMatch[0]);
    const now = new Date();
    const minEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const validPredictions = predictions
      .filter((p: any) => {
        if (!p.title) return false;
        if (p.endDate) {
          const endDate = new Date(p.endDate);
          return endDate > now;
        }
        return true;
      })
      .map((p: any) => ({
        title: p.title,
        description: p.description || '',
        category: detectCategory(p.title),
        endDate: p.endDate && new Date(p.endDate) > minEndDate ? p.endDate : minEndDate.toISOString().split('T')[0]
      }));

    console.log(`Perplexity returned ${validPredictions.length} Polymarket predictions`);
    return validPredictions;
  } catch (error) {
    console.error('Perplexity fetch error:', error);
    return [];
  }
}

// Generate AI predictions as fallback
async function generateAIPredictions(): Promise<Array<{ title: string; description: string; category: string; endDate?: string }>> {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are creating prediction market questions. Today is ${today}.

Generate exactly 10 prediction market questions that are timely and interesting:
- CRYPTO (3): Price targets, ETF approvals, market cap milestones
- POLITICS (2): Elections, policy decisions, international events  
- SPORTS (2): Upcoming championships, tournaments, matches
- TECH (2): Product launches, AI milestones, company news
- ENTERTAINMENT (1): Award shows, releases, celebrity news

RULES:
1. All end dates must be in the future (after ${today})
2. Be specific with measurable outcomes
3. Make questions engaging and relevant to current events

Return ONLY JSON array:
[{"title":"Will Bitcoin exceed $120,000 before April 2026?", "description":"BTC/USD reaching $120k on major exchanges", "category":"crypto", "endDate":"2026-04-01"}]`;

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
          { role: 'system', content: 'Return ONLY valid JSON array. Only future events.' },
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

    const predictions = JSON.parse(cleaned.trim());
    const now = new Date();

    const validPredictions = predictions
      .filter((p: any) => {
        if (p.endDate) {
          return new Date(p.endDate) > now;
        }
        return true;
      })
      .map((p: any) => ({
        ...p,
        category: detectCategory(p.title)
      }));

    console.log(`AI generated ${validPredictions.length} predictions`);
    return validPredictions;
  } catch (error) {
    console.error('AI generation error:', error);
    return [];
  }
}

async function syncPredictions(supabase: any): Promise<{ created: number; resolved: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let resolved = 0;

  // Fetch from all sources in parallel
  const [polymarketMarkets, perplexityMarkets, aiPredictions] = await Promise.all([
    fetchPolymarketData(),
    fetchPerplexityPolymarket(),
    generateAIPredictions()
  ]);

  const allMarkets = [...polymarketMarkets, ...perplexityMarkets, ...aiPredictions];
  console.log(`Total markets fetched: ${allMarkets.length} (Polymarket: ${polymarketMarkets.length}, Perplexity: ${perplexityMarkets.length}, AI: ${aiPredictions.length})`);

  // Get existing predictions
  const { data: existingPredictions } = await supabase
    .from('predictions')
    .select('title')
    .eq('status', 'active');

  const existingTitles = new Set((existingPredictions || []).map((p: any) => p.title.toLowerCase().slice(0, 50)));

  // Insert new predictions
  const currentYear = new Date().getFullYear();
  const pastYears = Array.from({ length: 10 }, (_, i) => String(currentYear - 1 - i)); // 2024, 2023, 2022, etc.
  
  for (const market of allMarkets) {
    if (!market.title) continue;

    const titleLower = market.title.toLowerCase();
    
    // Skip predictions with past years in title (prevents outdated predictions)
    const hasPastYear = pastYears.some(year => titleLower.includes(year));
    if (hasPastYear) {
      console.log(`Skipping outdated prediction: ${market.title.slice(0, 50)}`);
      continue;
    }
    
    // Skip non-Yes/No style predictions (multi-option, open-ended, vague)
    const invalidPatterns = [
      'which ', 'who will', 'what will', 'how many', 'how much',
      '# tweets', 'number of tweets', 'highest temperature', 'top performing',
      '#1 song', 'vs.', ' vs ', 'announced by', 'price on ',
      '___', '...',
      // Block vague/incomplete "Xth largest company" style predictions - they should be multi-option
      'largest company end of', 'largest company by market', '2nd largest', '3rd largest',
      'second largest', 'third largest', 'fourth largest'
    ];
    const hasInvalidPattern = invalidPatterns.some(pattern => titleLower.includes(pattern));
    if (hasInvalidPattern) {
      console.log(`Skipping non-Yes/No prediction: ${market.title.slice(0, 50)}`);
      continue;
    }
    
    // Must end with ? to be a proper question
    if (!market.title.trim().endsWith('?')) {
      console.log(`Skipping non-question: ${market.title.slice(0, 50)}`);
      continue;
    }

    const titleKey = titleLower.slice(0, 50);
    if (existingTitles.has(titleKey)) continue;

    const category: Category = CATEGORIES.includes(market.category as any)
      ? (market.category as Category)
      : 'politics';

    if (shouldBlockAutoMarket(market.title, category)) {
      console.log(`Skipping blocked/miscategorized topic: ${market.title.slice(0, 50)}`);
      continue;
    }

    const normalizedEndDate = normalizeAutoEndDate(
      market.endDate || calculateEndDate(category),
      category,
      market.title
    );

    if (!normalizedEndDate) {
      console.log(`Skipping far-future prediction: ${market.title.slice(0, 50)}`);
      continue;
    }

    const marketWithOdds = market as { yesOdds?: number; noOdds?: number; imageUrl?: string };
    const yesPool = marketWithOdds.yesOdds ? marketWithOdds.yesOdds * 100 : 0;
    const noPool = marketWithOdds.noOdds ? marketWithOdds.noOdds * 100 : 0;

    const newPrediction = {
      title: market.title.slice(0, 200),
      description: (market.description || '').slice(0, 500),
      category,
      escrow_address: generateEscrowAddress(),
      end_date: normalizedEndDate,
      status: 'active',
      yes_pool: yesPool,
      no_pool: noPool,
      image_url: marketWithOdds.imageUrl || null,
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
  // IMPORTANT: Disabled.
  // Resolution + payouts must be handled by the dedicated oracle resolver to avoid
  // incorrect outcomes and missing payout calculations.
  // (Leaving markets "active" after end_date is OK; the oracle resolver will pick them up.)


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
    console.log('Starting prediction sync (Polymarket + Perplexity + AI)...');
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
