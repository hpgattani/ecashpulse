import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChronikClient } from 'https://esm.sh/chronik-client@3.6.1';
import {
  sha256, hash256, hash160, toHex, fromHex, reverseHex,
  encodeVarInt, writeUint32LE, writeUint64LE,
  decodeWIF, cashAddrToHash160, getAddressHash,
  createP2PKHScript, createCashtabMessageScript,
  getPublicKey, signECDSA, bip143Sighash, buildSignedTransaction,
  type TxInput, type TxOutput,
} from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const chronik = new ChronikClient(['https://chronik.e.cash']);
const FALLBACK_ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

// ==================== Types ====================

interface UTXO {
  outpoint: { txid: string; outIdx: number };
  blockHeight: number;
  isCoinbase: boolean;
  value: string;
  isFinal: boolean;
  token?: any;
}

interface PayoutRecipient {
  address: string;
  amount: number;
  betIds: string[];
  userId: string;
}

// ==================== API Functions ====================

async function getUTXOs(address: string): Promise<UTXO[]> {
  const addressHash = getAddressHash(address);
  if (!addressHash) {
    console.error('Failed to get address hash');
    return [];
  }
  console.log(`Address hash: ${addressHash}`);
  
  try {
    console.log('Fetching UTXOs using chronik-client...');
    const scriptUtxos = await chronik.script('p2pkh', addressHash).utxos();
    
    if (scriptUtxos && scriptUtxos.utxos && scriptUtxos.utxos.length > 0) {
      console.log(`Got ${scriptUtxos.utxos.length} UTXOs`);
      const firstUtxo = scriptUtxos.utxos[0];
      console.log(`First UTXO keys: ${Object.keys(firstUtxo).join(', ')}`);
      
      return scriptUtxos.utxos.map((u: any) => {
        const valueStr = String(u.sats ?? u.value ?? u.atoms ?? 0);
        return {
          outpoint: { txid: u.outpoint.txid, outIdx: u.outpoint.outIdx },
          blockHeight: u.blockHeight || 0,
          isCoinbase: u.isCoinbase || false,
          value: valueStr,
          isFinal: u.isFinal !== false,
          token: u.token,
        };
      });
    }
    
    console.log('No UTXOs found in escrow wallet - wallet may be empty');
    return [];
  } catch (error) {
    console.error('chronik-client getUTXOs error:', error);
    return [];
  }
}

async function broadcastTransaction(rawTx: Uint8Array): Promise<string | null> {
  const txHex = toHex(rawTx);
  
  try {
    console.log('Broadcasting transaction using chronik-client...');
    console.log(`Raw TX hex (first 400 chars): ${txHex.substring(0, 400)}`);
    console.log(`Raw TX hex (rest): ${txHex.substring(400)}`);
    const result = await chronik.broadcastTx(txHex);
    console.log('Broadcast result:', result);
    return result.txid;
  } catch (error) {
    console.error('chronik-client broadcast error:', error);
    return null;
  }
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { prediction_id } = await req.json();
    console.log(`Processing payouts for prediction: ${prediction_id || 'all pending'}`);

    // Get all won OR refunded bets that haven't been paid out
    let query = supabase
      .from('bets')
      .select(`
        id,
        user_id,
        amount,
        payout_amount,
        status,
        prediction_id,
        users!inner(ecash_address)
      `)
      .in('status', ['won', 'refunded'])
      .is('payout_tx_hash', null)
      .not('payout_amount', 'is', null);

    if (prediction_id) {
      query = query.eq('prediction_id', prediction_id);
    }

    const { data: wonBets, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!wonBets || wonBets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending payouts', paid: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${wonBets.length} bets to pay out`);

    // Determine which escrow to use
    let escrowAddress = FALLBACK_ESCROW_ADDRESS;
    let privateKey: Uint8Array;
    let compressed: boolean;

    if (prediction_id) {
      const { data: predData } = await supabase
        .from('predictions')
        .select('escrow_address, escrow_privkey_encrypted')
        .eq('id', prediction_id)
        .single();

      if (predData?.escrow_privkey_encrypted) {
        const testKey = fromHex(predData.escrow_privkey_encrypted);
        const testPub = await getPublicKey(testKey, true);
        const testHash = await hash160(testPub);
        const addrHash = cashAddrToHash160(predData.escrow_address);
        const keyMatch = addrHash ? toHex(testHash) === toHex(addrHash) : false;
        
        if (keyMatch) {
          escrowAddress = predData.escrow_address;
          privateKey = testKey;
          compressed = true;
          console.log(`Using per-prediction escrow: ${escrowAddress}`);
        } else {
          console.log(`Per-prediction key MISMATCH (buggy hash) - falling back to global escrow`);
          const escrowWIF = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');
          if (!escrowWIF) throw new Error('ESCROW_PRIVATE_KEY_WIF not configured');
          const decoded = decodeWIF(escrowWIF);
          if (!decoded) throw new Error('Failed to decode escrow private key');
          privateKey = decoded.privateKey;
          compressed = decoded.compressed;
        }
      } else {
        const escrowWIF = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');
        if (!escrowWIF) throw new Error('ESCROW_PRIVATE_KEY_WIF not configured');
        const decoded = decodeWIF(escrowWIF);
        if (!decoded) throw new Error('Failed to decode escrow private key');
        privateKey = decoded.privateKey;
        compressed = decoded.compressed;
        console.log(`Using global escrow (no per-prediction key): ${escrowAddress}`);
      }
    } else {
      const escrowWIF = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');
      if (!escrowWIF) throw new Error('ESCROW_PRIVATE_KEY_WIF not configured');
      const decoded = decodeWIF(escrowWIF);
      if (!decoded) throw new Error('Failed to decode escrow private key');
      privateKey = decoded.privateKey;
      compressed = decoded.compressed;
    }

    // Group payouts by user address
    const userPayouts = new Map<string, PayoutRecipient>();

    for (const bet of wonBets) {
      const address = (bet.users as any).ecash_address;
      const existing = userPayouts.get(address);

      if (existing) {
        existing.amount += bet.payout_amount;
        existing.betIds.push(bet.id);
      } else {
        userPayouts.set(address, {
          address,
          amount: bet.payout_amount,
          betIds: [bet.id],
          userId: bet.user_id,
        });
      }
    }

    const recipients = Array.from(userPayouts.values());
    console.log(`Batched into ${recipients.length} recipients`);

    // Apply variable platform fee
    const DUST_LIMIT = 546;
    const platformFeePercent = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENT') || '1.0');
    console.log(`Platform fee: ${platformFeePercent}% (min ${DUST_LIMIT} sats per recipient)`);
    
    let totalFees = 0;
    const feesPerRecipient: Map<string, number> = new Map();
    
    for (const recipient of recipients) {
      const originalAmount = recipient.amount;
      const percentFee = Math.floor(originalAmount * (platformFeePercent / 100));
      const fee = Math.max(DUST_LIMIT, percentFee);
      const cappedFee = Math.min(fee, Math.floor(originalAmount * 0.5));
      const netAmount = originalAmount - cappedFee;
      
      const effectivePercent = ((cappedFee / originalAmount) * 100).toFixed(2);
      recipient.amount = netAmount;
      feesPerRecipient.set(recipient.userId, cappedFee);
      totalFees += cappedFee;
      
      console.log(`User ${recipient.userId}: Original ${originalAmount} XEC, Fee ${cappedFee} XEC (${effectivePercent}%), Net ${netAmount} XEC`);
    }
    
    console.log(`Total platform fees collected: ${totalFees} XEC`);

    const escrowHash = cashAddrToHash160(escrowAddress);
    if (!escrowHash) throw new Error('Invalid escrow address');

    const escrowScript = createP2PKHScript(escrowHash);
    console.log('Escrow wallet loaded');

    // Get UTXOs from primary escrow
    const utxos = await getUTXOs(escrowAddress);
    console.log(`Found ${utxos.length} UTXOs in escrow`);

    // Also try custodial wallet if different
    let custodialKey: Uint8Array | null = null;
    let custodialCompressed = true;
    let custodialUtxos: UTXO[] = [];
    
    if (escrowAddress !== FALLBACK_ESCROW_ADDRESS) {
      const escrowWIF = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');
      if (escrowWIF) {
        const decoded = decodeWIF(escrowWIF);
        if (decoded) {
          custodialKey = decoded.privateKey;
          custodialCompressed = decoded.compressed;
          custodialUtxos = await getUTXOs(FALLBACK_ESCROW_ADDRESS);
          console.log(`Found ${custodialUtxos.length} UTXOs in custodial wallet`);
        }
      }
    }

    const allUtxos = [...utxos, ...custodialUtxos];
    if (allUtxos.length === 0) throw new Error('No UTXOs available');

    let totalAvailable = 0;
    const validUtxos = allUtxos.filter(u => !u.token);
    for (const utxo of validUtxos) {
      totalAvailable += parseInt(utxo.value);
    }

    let totalPayout = recipients.reduce((sum, r) => sum + r.amount, 0);
    const estimatedFee = 500 + (recipients.length * 34) + (validUtxos.length * 180) + 50;
    
    console.log(`Total to pay: ${totalPayout}, Fee: ~${estimatedFee}, Available: ${totalAvailable}`);

    if (totalAvailable < totalPayout + estimatedFee) {
      const shortfall = (totalPayout + estimatedFee) - totalAvailable;
      console.log(`Shortfall of ${shortfall} sats - deducting TX fee from payouts proportionally`);
      
      const totalBeforeDeduction = totalPayout;
      for (const recipient of recipients) {
        const share = recipient.amount / totalBeforeDeduction;
        const deduction = Math.ceil(shortfall * share);
        recipient.amount = Math.max(546, recipient.amount - deduction);
        console.log(`Adjusted ${recipient.userId}: deducted ${deduction}, new amount ${recipient.amount}`);
      }
      totalPayout = recipients.reduce((sum, r) => sum + r.amount, 0);
      
      if (totalAvailable < totalPayout + estimatedFee) {
        throw new Error(`Insufficient funds even after fee deduction: need ${totalPayout + estimatedFee}, have ${totalAvailable}`);
      }
    }

    // Build inputs
    const inputs: TxInput[] = [];
    const perInputKeys: { privateKey: Uint8Array; compressed: boolean }[] = [];
    let inputTotal = 0n;
    const needed = BigInt(totalPayout + estimatedFee);
    
    const escrowValidUtxos = utxos.filter(u => !u.token);
    for (const utxo of escrowValidUtxos) {
      inputs.push({
        txid: utxo.outpoint.txid,
        vout: utxo.outpoint.outIdx,
        value: BigInt(utxo.value),
        scriptPubKey: escrowScript,
      });
      perInputKeys.push({ privateKey, compressed });
      inputTotal += BigInt(utxo.value);
      if (inputTotal >= needed) break;
    }

    if (inputTotal < needed && custodialKey && custodialUtxos.length > 0) {
      const custodialScript = createP2PKHScript(cashAddrToHash160(FALLBACK_ESCROW_ADDRESS)!);
      const custodialValidUtxos = custodialUtxos.filter(u => !u.token);
      for (const utxo of custodialValidUtxos) {
        inputs.push({
          txid: utxo.outpoint.txid,
          vout: utxo.outpoint.outIdx,
          value: BigInt(utxo.value),
          scriptPubKey: custodialScript,
        });
        perInputKeys.push({ privateKey: custodialKey, compressed: custodialCompressed });
        inputTotal += BigInt(utxo.value);
        if (inputTotal >= needed) break;
      }
      console.log(`Combined inputs from both wallets: ${inputs.length} total inputs, ${inputTotal} sats`);
    }

    // Build outputs
    const outputs: TxOutput[] = recipients.map(r => ({
      value: BigInt(r.amount),
      scriptPubKey: createP2PKHScript(cashAddrToHash160(r.address)!),
    }));

    // Platform fee output
    if (totalFees > 546) {
      const custodialHash = cashAddrToHash160(FALLBACK_ESCROW_ADDRESS);
      if (custodialHash) {
        outputs.push({
          value: BigInt(totalFees),
          scriptPubKey: createP2PKHScript(custodialHash),
        });
        console.log(`Added platform fee output: ${totalFees} XEC to custodial wallet`);
      }
    } else if (totalFees > 0) {
      console.log(`Platform fee ${totalFees} XEC is below dust limit (546) - redistributing to recipients`);
      const extraPerRecipient = Math.floor(totalFees / recipients.length);
      let remainder = totalFees - (extraPerRecipient * recipients.length);
      for (let i = 0; i < recipients.length; i++) {
        const extra = extraPerRecipient + (i === 0 ? remainder : 0);
        recipients[i].amount += extra;
        outputs[i] = {
          value: BigInt(recipients[i].amount),
          scriptPubKey: outputs[i].scriptPubKey,
        };
      }
      for (const recipient of recipients) {
        feesPerRecipient.set(recipient.userId, 0);
      }
      totalFees = 0;
      totalPayout = recipients.reduce((sum, r) => sum + r.amount, 0);
      console.log(`Adjusted total payout after fee redistribution: ${totalPayout} XEC`);
    }

    // OP_RETURN with Cashtab message
    const congratsMessage = Deno.env.get('PAYOUT_MESSAGE') || 'Congratulations for winning on eCash Pulse!';
    const opReturnScript = createCashtabMessageScript(congratsMessage);
    outputs.push({ value: 0n, scriptPubKey: opReturnScript });
    console.log(`Added Cashtab message: "${congratsMessage}"`);

    // Calculate change - ALWAYS goes to custodial wallet
    let outputTotal = outputs.reduce((a, b) => a + b.value, 0n);
    let change = inputTotal - outputTotal - BigInt(estimatedFee);
    const changeScript = createP2PKHScript(cashAddrToHash160(FALLBACK_ESCROW_ADDRESS)!);
    
    if (change > 546n) {
      outputs.push({ value: change, scriptPubKey: changeScript });
    } else {
      const actualFee = inputTotal - outputTotal;
      const minRelayFee = BigInt(Math.max(300, estimatedFee));
      if (actualFee < minRelayFee && outputTotal > 0n) {
        const deficit = minRelayFee - actualFee;
        console.log(`Actual fee ${actualFee} below min relay fee ${minRelayFee}, reducing payouts by ${deficit}`);
        for (let i = 0; i < outputs.length; i++) {
          if (outputs[i].value > 546n + deficit) {
            outputs[i] = { ...outputs[i], value: outputs[i].value - deficit };
            break;
          }
        }
      }
    }

    console.log(`Building tx: ${inputs.length} inputs, ${outputs.length} outputs`);

    const rawTx = await buildSignedTransaction(inputs, outputs, privateKey, compressed, perInputKeys.length > 0 ? perInputKeys : undefined);
    console.log(`Transaction built: ${rawTx.length} bytes`);

    const txid = await broadcastTransaction(rawTx);
    if (!txid) throw new Error('Failed to broadcast payout transaction');

    console.log(`Payout transaction broadcast: ${txid}`);

    // Update bet records
    for (const recipient of recipients) {
      const fee = feesPerRecipient.get(recipient.userId) || 0;
      await supabase
        .from('bets')
        .update({ payout_tx_hash: txid, platform_fee: fee })
        .in('id', recipient.betIds);
    }

    const allBetIds = recipients.flatMap(r => r.betIds);
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Payouts sent successfully',
        txid,
        recipients: recipients.length,
        total_amount: totalPayout,
        platform_fees: totalFees,
        net_amount: totalPayout - totalFees,
        fee_percent: platformFeePercent,
        bets_paid: allBetIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send payouts error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to send payouts',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
