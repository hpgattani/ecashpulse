import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChronikClient } from 'https://esm.sh/chronik-client@3.6.1';
import {
  toHex, fromHex, hash160,
  decodeWIF, cashAddrToHash160, getAddressHash,
  createP2PKHScript, createCashtabMessageScript,
  getPublicKey, buildSignedTransaction,
  type TxInput, type TxOutput,
} from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const chronik = new ChronikClient(['https://chronik.e.cash']);
const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

interface UTXO {
  outpoint: { txid: string; outIdx: number };
  blockHeight: number;
  isCoinbase: boolean;
  value: string;
  isFinal: boolean;
  token?: any;
}

async function getUTXOs(address: string): Promise<UTXO[]> {
  const addressHash = getAddressHash(address);
  if (!addressHash) return [];
  try {
    const scriptUtxos = await chronik.script('p2pkh', addressHash).utxos();
    if (scriptUtxos?.utxos?.length > 0) {
      return scriptUtxos.utxos.map((u: any) => ({
        outpoint: { txid: u.outpoint.txid, outIdx: u.outpoint.outIdx },
        blockHeight: u.blockHeight || 0,
        isCoinbase: u.isCoinbase || false,
        value: String(u.sats ?? u.value ?? u.atoms ?? 0),
        isFinal: u.isFinal !== false,
        token: u.token,
      }));
    }
    return [];
  } catch (error) {
    console.error('getUTXOs error:', error);
    return [];
  }
}

async function broadcastTransaction(rawTx: Uint8Array): Promise<string | null> {
  try {
    const result = await chronik.broadcastTx(toHex(rawTx));
    return result.txid;
  } catch (error) {
    console.error('broadcast error:', error);
    return null;
  }
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
    const { address, amount_xec, reason } = await req.json();
    
    if (!address || !amount_xec) {
      return new Response(
        JSON.stringify({ error: 'Missing address or amount_xec' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountSats = Math.round(amount_xec * 100);
    console.log(`Sending refund: ${amount_xec} XEC (${amountSats} sats) to ${address}`);
    console.log(`Reason: ${reason || 'Manual refund'}`);

    const recipientHash = cashAddrToHash160(address);
    if (!recipientHash) {
      return new Response(
        JSON.stringify({ error: 'Invalid eCash address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const escrowWIF = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');
    if (!escrowWIF) throw new Error('ESCROW_PRIVATE_KEY_WIF not configured');
    const decoded = decodeWIF(escrowWIF);
    if (!decoded) throw new Error('Failed to decode escrow private key');
    const { privateKey, compressed } = decoded;

    const escrowHash = cashAddrToHash160(ESCROW_ADDRESS);
    if (!escrowHash) throw new Error('Invalid escrow address');
    const escrowScript = createP2PKHScript(escrowHash);

    const utxos = await getUTXOs(ESCROW_ADDRESS);
    if (utxos.length === 0) throw new Error('No UTXOs available');

    let totalAvailable = 0;
    const validUtxos = utxos.filter(u => !u.token);
    for (const utxo of validUtxos) totalAvailable += parseInt(utxo.value);

    // Fee = 1 sat/byte, with proper size estimate per input
    const estimatedSize = 10 + (validUtxos.length * 180) + (3 * 34) + 50;
    const estimatedFee = Math.max(600, Math.ceil(estimatedSize * 1.1));

    if (totalAvailable < amountSats + estimatedFee) {
      throw new Error(`Insufficient funds: need ${amountSats + estimatedFee}, have ${totalAvailable}`);
    }

    const inputs: TxInput[] = [];
    let inputTotal = 0n;
    const needed = BigInt(amountSats + estimatedFee);
    for (const utxo of validUtxos) {
      inputs.push({ txid: utxo.outpoint.txid, vout: utxo.outpoint.outIdx, value: BigInt(utxo.value), scriptPubKey: escrowScript });
      inputTotal += BigInt(utxo.value);
      if (inputTotal >= needed) break;
    }

    const outputs: TxOutput[] = [];
    outputs.push({ value: BigInt(amountSats), scriptPubKey: createP2PKHScript(recipientHash) });

    const refundMessage = reason || 'Refund from eCash Pulse';
    outputs.push({ value: 0n, scriptPubKey: createCashtabMessageScript(refundMessage) });

    const outputTotal = outputs.reduce((a, b) => a + b.value, 0n);
    const change = inputTotal - outputTotal - BigInt(estimatedFee);
    if (change > 546n) {
      outputs.push({ value: change, scriptPubKey: escrowScript });
    }

    const rawTx = await buildSignedTransaction(inputs, outputs, privateKey, compressed);
    const txid = await broadcastTransaction(rawTx);
    if (!txid) throw new Error('Failed to broadcast refund transaction');

    console.log(`Refund transaction broadcast: ${txid}`);

    await supabase.from('bet_audit_log').insert({
      event_type: 'manual_refund_sent',
      metadata: { reason: reason || 'Manual refund', recipient_address: address, amount_xec, amount_sats: amountSats, txid },
    });

    return new Response(
      JSON.stringify({ success: true, message: `Refund of ${amount_xec} XEC sent`, txid, amount_xec, address }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Refund error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send refund' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
