import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEscrowMaterial, isEscrowMaterialConsistent } from '../_shared/escrow.ts';
import { encryptPrivkey } from '../_shared/escrowCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const title = 'Who wins Paris Saint-Germain vs Arsenal in the UCL on May 30?';

    const { data: existing } = await supabase
      .from('predictions')
      .select('id')
      .eq('title', title)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ skipped: true, id: existing.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const escrow = await generateEscrowMaterial();
    if (!isEscrowMaterialConsistent(escrow)) throw new Error('Escrow integrity check failed');

    // Match kickoff 9:30 PM IST May 30, 2026 = 16:00 UTC. Add 3h sports buffer to end_date.
    const endDate = new Date(Date.UTC(2026, 4, 30, 19, 0, 0)); // 19:00 UTC = ~kickoff + 3h

    const { data: pred, error } = await supabase
      .from('predictions')
      .insert({
        title,
        description:
          'UEFA Champions League match: Paris Saint-Germain FC vs Arsenal FC on May 30, 2026 (kickoff 9:30 PM IST). Resolves to the full-time result — PSG win, Arsenal win, or Draw (90 minutes + stoppage time only; extra time and penalties do not count).',
        category: 'sports',
        end_date: endDate.toISOString(),
        escrow_address: escrow.escrowAddress,
        escrow_privkey_encrypted: await encryptPrivkey(escrow.privkeyHex),
        escrow_script_hex: escrow.scriptHex,
        status: 'active',
        yes_pool: 0,
        no_pool: 0,
      })
      .select('id')
      .single();

    if (error) throw error;

    const outcomes = ['Paris Saint-Germain', 'Arsenal', 'Draw'];
    const { error: outErr } = await supabase
      .from('outcomes')
      .insert(outcomes.map((label) => ({ prediction_id: pred.id, label, pool: 0 })));

    if (outErr) throw outErr;

    return new Response(
      JSON.stringify({ created: true, id: pred.id, escrow: escrow.escrowAddress }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('seed-psg-arsenal error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
