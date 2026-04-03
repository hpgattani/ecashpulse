import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_ESCROW = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

const COINS = [
  { symbol: 'XEC', name: 'eCash (XEC)' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Target date is tomorrow (UTC)
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const dateStr = tomorrow.toISOString().slice(0, 10); // e.g. "2026-04-05"
    
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const month = monthNames[tomorrow.getUTCMonth()];
    const day = tomorrow.getUTCDate();

    const endDate = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 23, 59, 0));

    const created: string[] = [];
    const skipped: string[] = [];

    for (const coin of COINS) {
      const title = `${coin.name} Up or Down on ${month} ${day}?`;

      // Check if already exists for this date
      const { data: existing } = await supabase
        .from('predictions')
        .select('id')
        .eq('title', title)
        .maybeSingle();

      if (existing) {
        skipped.push(title);
        continue;
      }

      const description = `Resolves YES if ${coin.name} (${coin.symbol}) closes higher on ${month} ${day}, ${tomorrow.getUTCFullYear()} compared to the opening price. Resolves NO if it closes lower or unchanged.`;

      const { error } = await supabase.from('predictions').insert({
        title,
        description,
        category: 'crypto',
        end_date: endDate.toISOString(),
        escrow_address: FALLBACK_ESCROW,
        status: 'active',
        yes_pool: 0,
        no_pool: 0,
      });

      if (error) {
        console.error(`Failed to create ${title}:`, error);
      } else {
        created.push(title);
      }
    }

    console.log(`Daily crypto markets: created=${created.length}, skipped=${skipped.length}`);

    return new Response(JSON.stringify({ created, skipped, date: dateStr }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('cron-daily-crypto-markets error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
