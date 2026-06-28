import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEscrowMaterial, isEscrowMaterialConsistent } from '../_shared/escrow.ts';
import { encryptPrivkey } from '../_shared/escrowCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    if (!prediction_id) {
      return new Response(
        JSON.stringify({ error: 'prediction_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if prediction already has an escrow key
    const { data: prediction, error: fetchError } = await supabase
      .from('predictions')
      .select('id, escrow_address, escrow_privkey_encrypted')
      .eq('id', prediction_id)
      .single();

    if (fetchError || !prediction) {
      return new Response(
        JSON.stringify({ error: 'Prediction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already has a per-prediction escrow key, return existing address
    if (prediction.escrow_privkey_encrypted) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          escrow_address: prediction.escrow_address,
          message: 'Escrow already exists for this prediction'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const escrow = await generateEscrowMaterial();

    if (!isEscrowMaterialConsistent(escrow)) {
      throw new Error('Generated escrow material failed integrity check');
    }

    // Update prediction with escrow data
    const { error: updateError } = await supabase
      .from('predictions')
      .update({
        escrow_address: escrow.escrowAddress,
        escrow_privkey_encrypted: await encryptPrivkey(escrow.privkeyHex),
        escrow_script_hex: escrow.scriptHex,
      })
      .eq('id', prediction_id);

    if (updateError) {
      console.error('Failed to update prediction escrow:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to store escrow data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created per-prediction escrow for ${prediction_id}:`);
    console.log(`  Address: ${escrow.escrowAddress}`);
    console.log(`  PubKey: ${escrow.pubkeyHex}`);
    console.log(`  Script: ${escrow.scriptHex}`);

    return new Response(
      JSON.stringify({
        success: true,
        escrow_address: escrow.escrowAddress,
        pubkey: escrow.pubkeyHex,
        script_hex: escrow.scriptHex,
        message: 'Per-prediction escrow created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Create prediction escrow error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
