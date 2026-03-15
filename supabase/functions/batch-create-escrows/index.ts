import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as secp from 'https://esm.sh/@noble/secp256k1@2.1.0';
import { hash160ToCashAddr, hexToBytes, scriptHexToCashAddr } from '../_shared/cashaddr.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(data).buffer);
  return new Uint8Array(hash);
}

function ripemd160(data: Uint8Array): Uint8Array {
  const K1 = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  const K2 = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
  const R1 = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
  const R2 = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
  const S1 = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
  const S2 = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];

  const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;
  
  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const padLen = (msgLen % 64 < 56 ? 56 : 120) - (msgLen % 64);
  const padded = new Uint8Array(msgLen + padLen + 8);
  padded.set(data);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen, true);
  view.setUint32(padded.length - 4, 0, true);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  for (let i = 0; i < padded.length; i += 64) {
    const X: number[] = [];
    for (let j = 0; j < 16; j++) X[j] = view.getUint32(i + j * 4, true);

    let a1 = h0, b1 = h1, c1 = h2, d1 = h3, e1 = h4;
    let a2 = h0, b2 = h1, c2 = h2, d2 = h3, e2 = h4;

    for (let j = 0; j < 80; j++) {
      const jDiv16 = Math.floor(j / 16);
      let f1: number, f2: number;
      
      if (jDiv16 === 0) { f1 = b1 ^ c1 ^ d1; f2 = (b2 & c2) | (~b2 & d2); }
      else if (jDiv16 === 1) { f1 = (b1 & c1) | (~b1 & d1); f2 = (b2 | ~c2) ^ d2; }
      else if (jDiv16 === 2) { f1 = (b1 | ~c1) ^ d1; f2 = (b2 & d2) | (c2 & ~d2); }
      else if (jDiv16 === 3) { f1 = (b1 & d1) | (c1 & ~d1); f2 = b2 ^ c2 ^ d2; }
      else { f1 = b1 ^ (c1 | ~d1); f2 = (b2 & c2) | (~b2 & d2); }

      const t1 = (rotl((a1 + f1 + X[R1[j]] + K1[jDiv16]) >>> 0, S1[j]) + e1) >>> 0;
      a1 = e1; e1 = d1; d1 = rotl(c1, 10); c1 = b1; b1 = t1;

      const t2 = (rotl((a2 + f2 + X[R2[j]] + K2[jDiv16]) >>> 0, S2[j]) + e2) >>> 0;
      a2 = e2; e2 = d2; d2 = rotl(c2, 10); c2 = b2; b2 = t2;
    }

    const t = (h1 + c1 + d2) >>> 0;
    h1 = (h2 + d1 + e2) >>> 0;
    h2 = (h3 + e1 + a2) >>> 0;
    h3 = (h4 + a1 + b2) >>> 0;
    h4 = (h0 + b1 + c2) >>> 0;
    h0 = t;
  }

  const result = new Uint8Array(20);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, true); rv.setUint32(4, h1, true); rv.setUint32(8, h2, true);
  rv.setUint32(12, h3, true); rv.setUint32(16, h4, true);
  return result;
}

async function hash160(data: Uint8Array): Promise<Uint8Array> {
  return ripemd160(await sha256(data));
}

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

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch predictions', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!predictions || predictions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: repairExisting ? 'No active predictions to repair' : 'No predictions need escrow keys',
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

    for (const prediction of predictions) {
      try {
        if (repairExisting && prediction.escrow_privkey_encrypted) {
          let repairedScript = prediction.escrow_script_hex ?? null;
          let repairedAddress = repairedScript ? scriptHexToCashAddr(repairedScript) : null;

          // Fallback: derive from stored private key if script is missing/invalid.
          if (!repairedAddress) {
            const privateKeyBytes = hexToBytes(prediction.escrow_privkey_encrypted);
            const publicKeyBytes = secp.getPublicKey(privateKeyBytes, true);
            const pubkeyHash = await hash160(publicKeyBytes);
            repairedAddress = hash160ToCashAddr(pubkeyHash);
            repairedScript = '76a914' + toHex(pubkeyHash) + '88ac';
          }

          if (!repairedAddress) {
            throw new Error('Unable to derive escrow address from stored key/script');
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
        const privateKeyBytes = secp.utils.randomPrivateKey();
        const publicKeyBytes = secp.getPublicKey(privateKeyBytes, true);

        const pubkeyHash = await hash160(publicKeyBytes);
        const escrowAddress = hash160ToCashAddr(pubkeyHash);

        const privkeyHex = toHex(privateKeyBytes);
        const scriptHex = '76a914' + toHex(pubkeyHash) + '88ac';

        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            escrow_address: escrowAddress,
            escrow_privkey_encrypted: privkeyHex,
            escrow_script_hex: scriptHex,
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
            new_address: escrowAddress,
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
        total: predictions.length,
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
