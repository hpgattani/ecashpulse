import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChronikClient } from 'https://esm.sh/chronik-client@3.6.1';
import {
  toHex, fromHex, hash160,
  cashAddrToHash160, getAddressHash, createP2PKHScript,
  getPublicKey, buildSignedTransaction,
  type TxInput, type TxOutput,
} from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const chronik = new ChronikClient(['https://chronik.e.cash']);
const CUSTODIAL_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prediction_id, admin_password } = await req.json();
    
    const adminSecret = Deno.env.get('ADMIN_SECRET_PASSWORD');
    if (!admin_password || admin_password !== adminSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    if (!prediction_id) {
      return new Response(JSON.stringify({ error: 'prediction_id required' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: pred } = await supabase
      .from('predictions')
      .select('escrow_address, escrow_privkey_encrypted')
      .eq('id', prediction_id)
      .single();

    if (!pred?.escrow_privkey_encrypted) {
      return new Response(JSON.stringify({ error: 'No escrow key found for this prediction' }), { status: 404, headers: corsHeaders });
    }

    const escrowAddress = pred.escrow_address;
    const privateKey = fromHex(pred.escrow_privkey_encrypted);
    const compressed = true;

    // Verify key matches address
    const pubKey = await getPublicKey(privateKey, compressed);
    const pubHash = await hash160(pubKey);
    const addrHash = cashAddrToHash160(escrowAddress);
    if (!addrHash || toHex(pubHash) !== toHex(addrHash)) {
      return new Response(JSON.stringify({ error: 'Key does not match escrow address' }), { status: 400, headers: corsHeaders });
    }

    // Get UTXOs from escrow
    const addressHashHex = getAddressHash(escrowAddress);
    if (!addressHashHex) throw new Error('Invalid escrow address');

    const scriptUtxos = await chronik.script('p2pkh', addressHashHex).utxos();
    const utxos = scriptUtxos?.utxos?.filter((u: any) => !u.token) || [];

    if (utxos.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No UTXOs to sweep' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let totalValue = 0n;
    const escrowScript = createP2PKHScript(addrHash);

    const inputs: TxInput[] = utxos.map((u: any) => {
      const val = BigInt(String(u.sats ?? u.value ?? u.atoms ?? 0));
      totalValue += val;
      return {
        txid: u.outpoint.txid,
        vout: u.outpoint.outIdx,
        value: val,
        scriptPubKey: escrowScript,
      };
    });

    const estimatedFee = BigInt(10 + inputs.length * 180 + 34);
    const sendAmount = totalValue - estimatedFee;

    if (sendAmount < 546n) {
      return new Response(JSON.stringify({ error: `Amount too small to sweep: ${totalValue} sats` }), { status: 400, headers: corsHeaders });
    }

    const custodialHash = cashAddrToHash160(CUSTODIAL_ADDRESS)!;
    const outputs: TxOutput[] = [{
      value: sendAmount,
      scriptPubKey: createP2PKHScript(custodialHash),
    }];

    console.log(`Sweeping ${totalValue} sats (${utxos.length} UTXOs) from ${escrowAddress} to custodial. Fee: ${estimatedFee}`);

    const rawTx = await buildSignedTransaction(inputs, outputs, privateKey, compressed);

    const txHex = toHex(rawTx);
    const result = await chronik.broadcastTx(txHex);

    console.log(`Sweep TX broadcast: ${result.txid}`);

    return new Response(
      JSON.stringify({
        success: true,
        txid: result.txid,
        amount_swept: Number(totalValue),
        fee: Number(estimatedFee),
        net_amount: Number(sendAmount),
        from: escrowAddress,
        to: CUSTODIAL_ADDRESS,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sweep error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Sweep failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
