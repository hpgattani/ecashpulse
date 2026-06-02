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
const BONUS_AMOUNT_SATS = 100000;

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

  // Internal-only: must be invoked with the service role key.
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceKey
  );

  try {
    const { prediction_id, trigger_reason } = await req.json();
    console.log(`Sending bonus payouts for prediction: ${prediction_id}, reason: ${trigger_reason || 'YES resolution'}`);

    const { data: allBettors, error: fetchError } = await supabase
      .from('bets')
      .select('user_id, users!inner(ecash_address)')
      .in('status', ['confirmed', 'won', 'lost', 'refunded'])
      .not('users', 'is', null);

    if (fetchError) throw fetchError;
    if (!allBettors || allBettors.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No bettors found', paid: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const uniqueAddresses = new Map<string, string>();
    for (const bet of allBettors) {
      const address = (bet.users as any).ecash_address;
      if (address && !uniqueAddresses.has(address)) uniqueAddresses.set(address, bet.user_id);
    }

    const recipients = Array.from(uniqueAddresses.entries()).map(([address, userId]) => ({ address, userId, amount: BONUS_AMOUNT_SATS }));
    console.log(`Sending 1,000 XEC bonus to ${recipients.length} unique bettors`);

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

    const totalBonus = recipients.length * BONUS_AMOUNT_SATS;
    const estimatedFee = 500 + (recipients.length * 34) + (validUtxos.length * 180) + 50;

    if (totalAvailable < totalBonus + estimatedFee) {
      throw new Error(`Insufficient funds for bonus: need ${totalBonus + estimatedFee}, have ${totalAvailable}`);
    }

    const inputs: TxInput[] = [];
    let inputTotal = 0n;
    const needed = BigInt(totalBonus + estimatedFee);
    for (const utxo of validUtxos) {
      inputs.push({ txid: utxo.outpoint.txid, vout: utxo.outpoint.outIdx, value: BigInt(utxo.value), scriptPubKey: escrowScript });
      inputTotal += BigInt(utxo.value);
      if (inputTotal >= needed) break;
    }

    const outputs: TxOutput[] = recipients.map(r => ({
      value: BigInt(r.amount),
      scriptPubKey: createP2PKHScript(cashAddrToHash160(r.address)!),
    }));

    outputs.push({ value: 0n, scriptPubKey: createCashtabMessageScript('🎉 Bonus from eCash Pulse! A market resolved YES!') });

    const outputTotal = outputs.reduce((a, b) => a + b.value, 0n);
    const change = inputTotal - outputTotal - BigInt(estimatedFee);
    if (change > 546n) {
      outputs.push({ value: change, scriptPubKey: escrowScript });
    }

    const rawTx = await buildSignedTransaction(inputs, outputs, privateKey, compressed);
    const txid = await broadcastTransaction(rawTx);
    if (!txid) throw new Error('Failed to broadcast bonus transaction');

    console.log(`Bonus transaction broadcast: ${txid}`);

    await supabase.from('bet_audit_log').insert({
      event_type: 'bonus_payout_sent',
      prediction_id,
      metadata: { reason: trigger_reason || 'YES resolution', recipients_count: recipients.length, amount_per_recipient: BONUS_AMOUNT_SATS, total_amount: totalBonus, txid },
    });

    return new Response(
      JSON.stringify({ success: true, message: `Bonus payouts sent to ${recipients.length} bettors`, txid, recipients: recipients.length, amount_per_recipient: BONUS_AMOUNT_SATS / 100, total_amount: totalBonus / 100 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bonus payout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send bonus payouts' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
