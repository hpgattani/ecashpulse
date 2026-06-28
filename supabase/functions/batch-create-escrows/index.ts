import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deriveEscrowMaterialFromPrivateKey, generateEscrowMaterial, isEscrowMaterialConsistent } from '../_shared/escrow.ts';
import { scriptHexToCashAddr } from '../_shared/cashaddr.ts';
import { decryptPrivkey, encryptPrivkey } from '../_shared/escrowCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const repairExisting = requestBody?.repair_existing === true;

    // Default mode: only generate missing escrows.
    // Repair mode: validate and repair all active prediction addresses from script/keys.
    let predictionsQuery = supabase
      .from('predictions')
      .select('id, title, escrow_address, escrow_script_hex, escrow_privkey_encrypted')
      .eq('status', 'active');

    if (!repairExisting) {
      predictionsQuery = predictionsQuery.is('escrow_privkey_encrypted', null);
    }

    const { data: predictions, error: fetchError } = await predictionsQuery;

    // In generation mode, exclude predictions that already have bets to avoid
    // changing the escrow address users have already paid into.
    let filteredPredictions = predictions;
    if (!repairExisting && predictions && predictions.length > 0) {
      const ids = predictions.map((p) => p.id);
      const { data: betsRows } = await supabase
        .from('bets')
        .select('prediction_id')
        .in('prediction_id', ids);
      const withBets = new Set((betsRows || []).map((b: { prediction_id: string }) => b.prediction_id));
      filteredPredictions = predictions.filter((p) => !withBets.has(p.id));
    }

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch predictions', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const workingPredictions = filteredPredictions || [];
    if (workingPredictions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: repairExisting ? 'No active predictions to repair' : 'No predictions need escrow keys (or all candidates already have bets)',
          count: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{
      id: string;
      title: string;
      mode: 'generated' | 'repaired' | 'unchanged';
      old_address: string | null;
      new_address: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const prediction of workingPredictions) {
      try {
        if (repairExisting && prediction.escrow_privkey_encrypted) {
          let repairedAddress = prediction.escrow_script_hex ? scriptHexToCashAddr(prediction.escrow_script_hex) : null;
          let repairedScript = prediction.escrow_script_hex ?? null;

          const repaired = await deriveEscrowMaterialFromPrivateKey(await decryptPrivkey(prediction.escrow_privkey_encrypted));
          repairedAddress = repaired.escrowAddress;
          repairedScript = repaired.scriptHex;

          if (!isEscrowMaterialConsistent(repaired)) {
            throw new Error('Derived escrow material failed integrity check');
          }

          const needsAddressUpdate = prediction.escrow_address !== repairedAddress;
          const needsScriptUpdate = !prediction.escrow_script_hex && Boolean(repairedScript);

          if (!needsAddressUpdate && !needsScriptUpdate) {
            results.push({
              id: prediction.id,
              title: prediction.title,
              mode: 'unchanged',
              old_address: prediction.escrow_address,
              new_address: repairedAddress,
              success: true,
            });
            continue;
          }

          const updatePayload: { escrow_address: string; escrow_script_hex?: string } = {
            escrow_address: repairedAddress,
          };
          if (needsScriptUpdate && repairedScript) {
            updatePayload.escrow_script_hex = repairedScript;
          }

          const { error: updateError } = await supabase
            .from('predictions')
            .update(updatePayload)
            .eq('id', prediction.id);

          if (updateError) {
            results.push({
              id: prediction.id,
              title: prediction.title,
              mode: 'repaired',
              old_address: prediction.escrow_address,
              new_address: '',
              success: false,
              error: updateError.message,
            });
          } else {
            results.push({
              id: prediction.id,
              title: prediction.title,
              mode: 'repaired',
              old_address: prediction.escrow_address,
              new_address: repairedAddress,
              success: true,
            });
          }

          continue;
        }

        // Generation mode for predictions without private keys.
        const escrow = await generateEscrowMaterial();
        if (!isEscrowMaterialConsistent(escrow)) {
          throw new Error('Generated escrow material failed integrity check');
        }

        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            escrow_address: escrow.escrowAddress,
            escrow_privkey_encrypted: escrow.privkeyHex,
            escrow_script_hex: escrow.scriptHex,
          })
          .eq('id', prediction.id);

        if (updateError) {
          results.push({
            id: prediction.id,
            title: prediction.title,
            mode: 'generated',
            old_address: prediction.escrow_address,
            new_address: '',
            success: false,
            error: updateError.message,
          });
        } else {
          results.push({
            id: prediction.id,
            title: prediction.title,
            mode: 'generated',
            old_address: prediction.escrow_address,
            new_address: escrow.escrowAddress,
            success: true,
          });
        }
      } catch (err) {
        results.push({
          id: prediction.id,
          title: prediction.title,
          mode: repairExisting ? 'repaired' : 'generated',
          old_address: prediction.escrow_address,
          new_address: '',
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const repairedCount = results.filter((r) => r.mode === 'repaired' && r.success).length;
    const generatedCount = results.filter((r) => r.mode === 'generated' && r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        total: workingPredictions.length,
        generated: generatedCount,
        repaired: repairedCount,
        unchanged: results.filter((r) => r.mode === 'unchanged').length,
        failed: failCount,
        processed: successCount,
        repair_mode: repairExisting,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Batch escrow creation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
