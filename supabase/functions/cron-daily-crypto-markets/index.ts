import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEscrowMaterial, isEscrowMaterialConsistent } from '../_shared/escrow.ts';
import { encryptPrivkey } from '../_shared/escrowCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COINS = [
  { symbol: 'XEC', name: 'eCash (XEC)' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
];

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const dateStr = tomorrow.toISOString().slice(0, 10);
    
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const month = monthNames[tomorrow.getUTCMonth()];
    const day = tomorrow.getUTCDate();

    const endDate = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 23, 59, 0));

    const created: string[] = [];
    const skipped: string[] = [];

    for (const coin of COINS) {
      const title = `${coin.name} Up or Down on ${month} ${day}?`;

      const { data: existing } = await supabase
        .from('predictions')
        .select('id')
        .eq('title', title)
        .maybeSingle();

      if (existing) {
        skipped.push(title);
        continue;
      }

      // Generate unique per-prediction escrow keypair
        const escrow = await generateEscrowMaterial();
        if (!isEscrowMaterialConsistent(escrow)) {
          throw new Error('Generated escrow material failed integrity check');
        }

      const description = `Resolves YES if ${coin.name} (${coin.symbol}) closes higher on ${month} ${day}, ${tomorrow.getUTCFullYear()} compared to the opening price. Resolves NO if it closes lower or unchanged.`;

      const { error } = await supabase.from('predictions').insert({
        title,
        description,
        category: 'crypto',
        end_date: endDate.toISOString(),
          escrow_address: escrow.escrowAddress,
          escrow_privkey_encrypted: await encryptPrivkey(escrow.privkeyHex),
          escrow_script_hex: escrow.scriptHex,
        status: 'active',
        yes_pool: 0,
        no_pool: 0,
      });

      if (error) {
        console.error(`Failed to create ${title}:`, error);
      } else {
          console.log(`Created ${title} with escrow: ${escrow.escrowAddress}`);
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
