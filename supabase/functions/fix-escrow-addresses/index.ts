import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deriveEscrowMaterialFromPrivateKey, isEscrowMaterialConsistent } from '../_shared/escrow.ts';
import { decryptPrivkey } from '../_shared/escrowCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

// ==================== Main Handler ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { prediction_id } = await req.json();

    // Get predictions with per-prediction escrow keys
    let query = supabase
      .from('predictions')
      .select('id, escrow_address, escrow_privkey_encrypted, escrow_script_hex')
      .not('escrow_privkey_encrypted', 'is', null);

    if (prediction_id) {
      query = query.eq('id', prediction_id);
    }

    const { data: predictions, error } = await query;
    if (error) throw error;

    const results: any[] = [];

    for (const pred of predictions || []) {
      const privKeyHex = pred.escrow_privkey_encrypted;
      const normalizedHex = fromHex(privKeyHex).length ? privKeyHex : '';
      const escrow = await deriveEscrowMaterialFromPrivateKey(normalizedHex);

      if (!isEscrowMaterialConsistent(escrow)) {
        throw new Error(`Derived escrow material failed integrity check for ${pred.id}`);
      }

      const correctAddress = escrow.escrowAddress;
      const correctScriptHex = escrow.scriptHex;

      const oldAddress = pred.escrow_address;
      const isMatch = oldAddress === correctAddress;

      if (!isMatch) {
        // Update to the correct address
        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            escrow_address: correctAddress,
            escrow_script_hex: correctScriptHex,
          })
          .eq('id', pred.id);

        if (updateError) {
          console.error(`Failed to fix ${pred.id}:`, updateError);
          results.push({ id: pred.id, status: 'error', error: updateError.message });
        } else {
          console.log(`Fixed ${pred.id}: ${oldAddress} → ${correctAddress}`);
          results.push({
            id: pred.id,
            status: 'fixed',
            old_address: oldAddress,
            new_address: correctAddress,
          });
        }
      } else {
        results.push({ id: pred.id, status: 'already_correct', address: correctAddress });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: predictions?.length || 0,
        fixed: results.filter(r => r.status === 'fixed').length,
        already_correct: results.filter(r => r.status === 'already_correct').length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Fix escrow addresses error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
