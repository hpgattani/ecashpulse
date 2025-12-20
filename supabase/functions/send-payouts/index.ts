import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  decodePrivateKeyWif,
  secp256k1,
  sha256,
  ripemd160,
  encodeCashAddress,
  CashAddressType,
  hexToBin,
  binToHex,
} from 'https://esm.sh/@bitauth/libauth@3.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHRONIK_URL = 'https://chronik.be.cash/xec';
const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

// ==================== Utility Functions ====================

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
  betId: string;
  userId: string;
}

// Convert eCash cashaddr to 20-byte pubkey hash
function addressToPkh(address: string): Uint8Array | null {
  try {
    const addr = address.replace('ecash:', '');
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

    let data: number[] = [];
    for (let i = 0; i < addr.length; i++) {
      const charIndex = CHARSET.indexOf(addr[i].toLowerCase());
      if (charIndex === -1) return null;
      data.push(charIndex);
    }

    const payloadEnd = data.length - 8;
    const payload5bit = data.slice(0, payloadEnd);

    let acc = 0;
    let bits = 0;
    const payload8bit: number[] = [];

    for (const value of payload5bit) {
      acc = (acc << 5) | value;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        payload8bit.push((acc >> bits) & 0xff);
      }
    }

    if (payload8bit.length < 21) return null;

    return new Uint8Array(payload8bit.slice(1, 21));
  } catch (error) {
    console.error('Address conversion error:', error);
    return null;
  }
}

// Get address hash for Chronik API
function getAddressHash(address: string): string | null {
  const pkh = addressToPkh(address);
  if (!pkh) return null;
  return binToHex(pkh);
}

// Get UTXOs for an address
async function getUTXOs(address: string): Promise<UTXO[]> {
  try {
    const addressHash = getAddressHash(address);
    if (!addressHash) {
      console.error('Failed to get address hash');
      return [];
    }

    const response = await fetch(`${CHRONIK_URL}/script/p2pkh/${addressHash}/utxos`);

    if (!response.ok) {
      console.error('Failed to fetch UTXOs:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return data.utxos || [];
  } catch (error) {
    console.error('Error fetching UTXOs:', error);
    return [];
  }
}

// Broadcast transaction
async function broadcastTransaction(txHex: string): Promise<string | null> {
  try {
    const response = await fetch(`${CHRONIK_URL}/broadcast-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawTx: txHex }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Broadcast failed:', error);
      return null;
    }

    const data = await response.json();
    return data.txid;
  } catch (error) {
    console.error('Broadcast error:', error);
    return null;
  }
}

// ==================== Transaction Building ====================

// Encode varint
function encodeVarint(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) return new Uint8Array([0xfd, n & 0xff, (n >> 8) & 0xff]);
  if (n <= 0xffffffff) return new Uint8Array([0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
  throw new Error('Value too large for varint');
}

// Encode script with length prefix
function encodeScript(script: Uint8Array): Uint8Array {
  const len = encodeVarint(script.length);
  const result = new Uint8Array(len.length + script.length);
  result.set(len, 0);
  result.set(script, len.length);
  return result;
}

// Create P2PKH output script
function createP2PKHScript(pkh: Uint8Array): Uint8Array {
  // OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
  const script = new Uint8Array(25);
  script[0] = 0x76; // OP_DUP
  script[1] = 0xa9; // OP_HASH160
  script[2] = 0x14; // Push 20 bytes
  script.set(pkh, 3);
  script[23] = 0x88; // OP_EQUALVERIFY
  script[24] = 0xac; // OP_CHECKSIG
  return script;
}

// Double SHA256
function hash256(data: Uint8Array): Uint8Array {
  return sha256.hash(sha256.hash(data));
}

// Reverse bytes
function reverseBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes.slice().reverse());
}

// Write 32-bit little-endian
function writeUint32LE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  buf[2] = (value >> 16) & 0xff;
  buf[3] = (value >> 24) & 0xff;
  return buf;
}

// Write 64-bit little-endian (for satoshi amounts)
function writeUint64LE(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((value >> BigInt(i * 8)) & BigInt(0xff));
  }
  return buf;
}

interface TxInput {
  txid: string;
  vout: number;
  value: bigint;
  scriptPubKey: Uint8Array;
}

interface TxOutput {
  value: bigint;
  scriptPubKey: Uint8Array;
}

// Build BIP143 sighash preimage for eCash/BCH
function buildSighashPreimage(
  inputs: TxInput[],
  outputs: TxOutput[],
  inputIndex: number,
  sighashType: number
): Uint8Array {
  const input = inputs[inputIndex];

  // Version (4 bytes)
  const version = writeUint32LE(2);

  // hashPrevouts
  let prevoutsData = new Uint8Array(0);
  for (const inp of inputs) {
    const txidBytes = reverseBytes(hexToBin(inp.txid));
    const voutBytes = writeUint32LE(inp.vout);
    const newData = new Uint8Array(prevoutsData.length + 36);
    newData.set(prevoutsData, 0);
    newData.set(txidBytes, prevoutsData.length);
    newData.set(voutBytes, prevoutsData.length + 32);
    prevoutsData = newData;
  }
  const hashPrevouts = hash256(prevoutsData);

  // hashSequence
  let sequenceData = new Uint8Array(0);
  for (let i = 0; i < inputs.length; i++) {
    const seqBytes = writeUint32LE(0xffffffff);
    const newData = new Uint8Array(sequenceData.length + 4);
    newData.set(sequenceData, 0);
    newData.set(seqBytes, sequenceData.length);
    sequenceData = newData;
  }
  const hashSequence = hash256(sequenceData);

  // outpoint
  const outpointTxid = reverseBytes(hexToBin(input.txid));
  const outpointVout = writeUint32LE(input.vout);

  // scriptCode (P2PKH script)
  const scriptCode = encodeScript(input.scriptPubKey);

  // value
  const valueBytes = writeUint64LE(input.value);

  // sequence
  const sequence = writeUint32LE(0xffffffff);

  // hashOutputs
  let outputsData = new Uint8Array(0);
  for (const out of outputs) {
    const valBytes = writeUint64LE(out.value);
    const scriptBytes = encodeScript(out.scriptPubKey);
    const newData = new Uint8Array(outputsData.length + 8 + scriptBytes.length);
    newData.set(outputsData, 0);
    newData.set(valBytes, outputsData.length);
    newData.set(scriptBytes, outputsData.length + 8);
    outputsData = newData;
  }
  const hashOutputs = hash256(outputsData);

  // locktime
  const locktime = writeUint32LE(0);

  // sighash type (with FORKID)
  const sighashTypeBytes = writeUint32LE(sighashType);

  // Combine all
  const preimage = new Uint8Array(
    4 + 32 + 32 + 32 + 4 + scriptCode.length + 8 + 4 + 32 + 4 + 4
  );
  let offset = 0;
  preimage.set(version, offset); offset += 4;
  preimage.set(hashPrevouts, offset); offset += 32;
  preimage.set(hashSequence, offset); offset += 32;
  preimage.set(outpointTxid, offset); offset += 32;
  preimage.set(outpointVout, offset); offset += 4;
  preimage.set(scriptCode, offset); offset += scriptCode.length;
  preimage.set(valueBytes, offset); offset += 8;
  preimage.set(sequence, offset); offset += 4;
  preimage.set(hashOutputs, offset); offset += 32;
  preimage.set(locktime, offset); offset += 4;
  preimage.set(sighashTypeBytes, offset);

  return preimage;
}

// Build and sign transaction
async function buildAndSignTransaction(
  privateKeyWif: string,
  utxos: UTXO[],
  recipients: PayoutRecipient[],
  changeAddress: string
): Promise<string | null> {
  try {
    // Decode private key
    const decoded = decodePrivateKeyWif(privateKeyWif);
    if (typeof decoded === 'string') {
      console.error('Failed to decode WIF:', decoded);
      return null;
    }
    const privateKey = decoded.privateKey;

    // Get public key
    const pubkeyResult = secp256k1.derivePublicKeyCompressed(privateKey);
    if (typeof pubkeyResult === 'string') {
      console.error('Failed to derive public key:', pubkeyResult);
      return null;
    }
    const publicKey = pubkeyResult;

    // Get our PKH
    const pubkeyHash = ripemd160.hash(sha256.hash(publicKey));

    // Create P2PKH script for our address
    const ourScript = createP2PKHScript(pubkeyHash);

    // Select UTXOs and calculate totals
    let totalInput = BigInt(0);
    const selectedUtxos: UTXO[] = [];
    const totalNeeded = recipients.reduce((sum, r) => sum + r.amount, 0);
    const feePerByte = 1; // 1 sat/byte
    const estimatedTxSize = 10 + (148 * utxos.length) + (34 * (recipients.length + 1)); // rough estimate
    const fee = estimatedTxSize * feePerByte;

    for (const utxo of utxos) {
      if (utxo.token) continue; // Skip token UTXOs
      selectedUtxos.push(utxo);
      totalInput += BigInt(utxo.value);
      if (totalInput >= BigInt(totalNeeded + fee)) break;
    }

    if (totalInput < BigInt(totalNeeded + fee)) {
      console.error(`Insufficient funds: need ${totalNeeded + fee}, have ${totalInput}`);
      return null;
    }

    // Build inputs
    const inputs: TxInput[] = selectedUtxos.map(utxo => ({
      txid: utxo.outpoint.txid,
      vout: utxo.outpoint.outIdx,
      value: BigInt(utxo.value),
      scriptPubKey: ourScript,
    }));

    // Build outputs
    const outputs: TxOutput[] = [];
    for (const recipient of recipients) {
      const recipientPkh = addressToPkh(recipient.address);
      if (!recipientPkh) {
        console.error('Invalid recipient address:', recipient.address);
        continue;
      }
      outputs.push({
        value: BigInt(recipient.amount),
        scriptPubKey: createP2PKHScript(recipientPkh),
      });
    }

    // Change output
    const totalOutput = outputs.reduce((sum, o) => sum + o.value, BigInt(0));
    const change = totalInput - totalOutput - BigInt(fee);
    if (change > BigInt(546)) { // Dust threshold
      const changePkh = addressToPkh(changeAddress);
      if (changePkh) {
        outputs.push({
          value: change,
          scriptPubKey: createP2PKHScript(changePkh),
        });
      }
    }

    // SIGHASH_ALL | SIGHASH_FORKID (0x41)
    const sighashType = 0x41;

    // Sign each input
    const signatures: Uint8Array[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const preimage = buildSighashPreimage(inputs, outputs, i, sighashType);
      const sighash = hash256(preimage);

      const signResult = secp256k1.signMessageHashSchnorr(privateKey, sighash);
      if (typeof signResult === 'string') {
        console.error('Signing failed:', signResult);
        return null;
      }

      // Append sighash type
      const sigWithType = new Uint8Array(signResult.length + 1);
      sigWithType.set(signResult, 0);
      sigWithType[signResult.length] = sighashType;
      signatures.push(sigWithType);
    }

    // Build raw transaction
    let tx = new Uint8Array(0);

    // Version
    const appendToTx = (data: Uint8Array) => {
      const newTx = new Uint8Array(tx.length + data.length);
      newTx.set(tx, 0);
      newTx.set(data, tx.length);
      tx = newTx;
    };

    appendToTx(writeUint32LE(2)); // version 2

    // Input count
    appendToTx(encodeVarint(inputs.length));

    // Inputs
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      appendToTx(reverseBytes(hexToBin(input.txid))); // txid
      appendToTx(writeUint32LE(input.vout)); // vout

      // ScriptSig: <sig> <pubkey>
      const sig = signatures[i];
      const scriptSig = new Uint8Array(1 + sig.length + 1 + publicKey.length);
      scriptSig[0] = sig.length;
      scriptSig.set(sig, 1);
      scriptSig[1 + sig.length] = publicKey.length;
      scriptSig.set(publicKey, 2 + sig.length);

      appendToTx(encodeScript(scriptSig)); // scriptSig with length
      appendToTx(writeUint32LE(0xffffffff)); // sequence
    }

    // Output count
    appendToTx(encodeVarint(outputs.length));

    // Outputs
    for (const output of outputs) {
      appendToTx(writeUint64LE(output.value)); // value
      appendToTx(encodeScript(output.scriptPubKey)); // scriptPubKey with length
    }

    // Locktime
    appendToTx(writeUint32LE(0));

    return binToHex(tx);
  } catch (error) {
    console.error('Transaction building error:', error);
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

    // Get all won bets that haven't been paid out yet
    let query = supabase
      .from('bets')
      .select(`
        id,
        user_id,
        amount,
        payout_amount,
        users!inner(ecash_address)
      `)
      .eq('status', 'won')
      .is('payout_tx_hash', null)
      .not('payout_amount', 'is', null);

    if (prediction_id) {
      query = query.eq('prediction_id', prediction_id);
    }

    const { data: wonBets, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!wonBets || wonBets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending payouts',
          paid: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${wonBets.length} bets to pay out`);

    // Get escrow wallet credentials
    const escrowPrivateKey = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');

    if (!escrowPrivateKey) {
      throw new Error('ESCROW_PRIVATE_KEY_WIF environment variable not set');
    }

    // Check UTXOs available in escrow
    const utxos = await getUTXOs(ESCROW_ADDRESS);
    console.log(`Found ${utxos.length} UTXOs in escrow`);

    if (utxos.length === 0) {
      throw new Error('No UTXOs available in escrow wallet');
    }

    // Calculate total available
    let totalAvailable = BigInt(0);
    for (const utxo of utxos) {
      if (!utxo.token) {
        totalAvailable += BigInt(utxo.value);
      }
    }

    // Group payouts by user (to batch multiple winnings)
    const userPayouts = new Map<string, PayoutRecipient>();

    for (const bet of wonBets) {
      const address = (bet.users as any).ecash_address;
      const existing = userPayouts.get(address);

      if (existing) {
        existing.amount += bet.payout_amount;
      } else {
        userPayouts.set(address, {
          address,
          amount: bet.payout_amount,
          betId: bet.id,
          userId: bet.user_id,
        });
      }
    }

    const recipients = Array.from(userPayouts.values());
    const totalPayout = recipients.reduce((sum, r) => sum + r.amount, 0);

    console.log(`Batched into ${recipients.length} recipients, total: ${totalPayout} sats`);
    console.log(`Available balance: ${totalAvailable} sats`);

    if (totalAvailable < BigInt(totalPayout)) {
      throw new Error(`Insufficient funds: need ${totalPayout}, have ${totalAvailable}`);
    }

    // Build and sign transaction
    console.log('Building and signing transaction...');
    const rawTx = await buildAndSignTransaction(
      escrowPrivateKey,
      utxos,
      recipients,
      ESCROW_ADDRESS // Change goes back to escrow
    );

    if (!rawTx) {
      throw new Error('Failed to build transaction');
    }

    console.log(`Transaction built: ${rawTx.slice(0, 64)}...`);

    // Broadcast transaction
    console.log('Broadcasting transaction...');
    const txid = await broadcastTransaction(rawTx);

    if (!txid) {
      throw new Error('Failed to broadcast transaction');
    }

    console.log(`Transaction broadcast successful! TXID: ${txid}`);

    // Update all paid bets with the tx hash
    for (const bet of wonBets) {
      await supabase
        .from('bets')
        .update({ payout_tx_hash: txid })
        .eq('id', bet.id);
    }

    console.log(`Updated ${wonBets.length} bets with payout tx hash`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payouts sent successfully',
        txid,
        recipients: recipients.length,
        total_amount: totalPayout,
        bets_paid: wonBets.length,
        explorer_url: `https://explorer.e.cash/tx/${txid}`,
        details: recipients.map((r) => ({
          address: r.address,
          amount: r.amount,
          userId: r.userId,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send payouts error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send payouts',
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
