import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChronikClient } from 'https://esm.sh/chronik-client@3.6.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const chronik = new ChronikClient(['https://chronik.e.cash']);
const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

// ==================== Crypto Primitives ====================

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(hash);
}

async function hash256(data: Uint8Array): Promise<Uint8Array> {
  return sha256(await sha256(data));
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

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

function reverseHex(hex: string): string {
  return hex.match(/.{2}/g)!.reverse().join('');
}

function encodeVarInt(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    new DataView(buf.buffer).setUint16(1, n, true);
    return buf;
  }
  const buf = new Uint8Array(5);
  buf[0] = 0xfe;
  new DataView(buf.buffer).setUint32(1, n, true);
  return buf;
}

function writeUint32LE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, true);
  return buf;
}

function writeUint64LE(n: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, n, true);
  return buf;
}

// ==================== WIF & Address Utilities ====================

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodeBase58(str: string): Uint8Array | null {
  try {
    let num = 0n;
    for (const char of str) {
      const idx = BASE58_ALPHABET.indexOf(char);
      if (idx === -1) return null;
      num = num * 58n + BigInt(idx);
    }
    
    let hex = num.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    
    let leadingZeros = 0;
    for (const char of str) {
      if (char === '1') leadingZeros++;
      else break;
    }
    
    const bytes = fromHex(hex);
    const result = new Uint8Array(leadingZeros + bytes.length);
    result.set(bytes, leadingZeros);
    return result;
  } catch {
    return null;
  }
}

function decodeWIF(wif: string): { privateKey: Uint8Array; compressed: boolean } | null {
  const decoded = decodeBase58(wif);
  if (!decoded) return null;
  
  if (decoded.length === 37) {
    return { privateKey: decoded.slice(1, 33), compressed: false };
  } else if (decoded.length === 38 && decoded[33] === 0x01) {
    return { privateKey: decoded.slice(1, 33), compressed: true };
  }
  
  return null;
}

function cashAddrToHash160(address: string): Uint8Array | null {
  try {
    const addr = address.replace('ecash:', '');
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

    const data: number[] = [];
    for (let i = 0; i < addr.length; i++) {
      const charIndex = CHARSET.indexOf(addr[i].toLowerCase());
      if (charIndex === -1) return null;
      data.push(charIndex);
    }

    const payloadEnd = data.length - 8;
    const payload5bit = data.slice(0, payloadEnd);

    let acc = 0, bits = 0;
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
  } catch {
    return null;
  }
}

function getAddressHash(address: string): string | null {
  const hash = cashAddrToHash160(address);
  return hash ? toHex(hash) : null;
}

function createP2PKHScript(hash160: Uint8Array): Uint8Array {
  const script = new Uint8Array(25);
  script[0] = 0x76; // OP_DUP
  script[1] = 0xa9; // OP_HASH160
  script[2] = 0x14; // Push 20 bytes
  script.set(hash160, 3);
  script[23] = 0x88; // OP_EQUALVERIFY
  script[24] = 0xac; // OP_CHECKSIG
  return script;
}

function createCashtabMessageScript(message: string): Uint8Array {
  const CASHTAB_LOKAD = new Uint8Array([0x00, 0x74, 0x61, 0x62]);
  const messageBytes = new TextEncoder().encode(message);
  
  function pushBytesOp(data: Uint8Array): Uint8Array {
    if (data.length <= 75) {
      const result = new Uint8Array(1 + data.length);
      result[0] = data.length;
      result.set(data, 1);
      return result;
    } else if (data.length <= 255) {
      const result = new Uint8Array(2 + data.length);
      result[0] = 0x4c;
      result[1] = data.length;
      result.set(data, 2);
      return result;
    } else {
      const result = new Uint8Array(3 + data.length);
      result[0] = 0x4d;
      result[1] = data.length & 0xff;
      result[2] = (data.length >> 8) & 0xff;
      result.set(data, 3);
      return result;
    }
  }
  
  const lokadPush = pushBytesOp(CASHTAB_LOKAD);
  const messagePush = pushBytesOp(messageBytes);
  
  const script = new Uint8Array(1 + lokadPush.length + messagePush.length);
  let offset = 0;
  script[offset++] = 0x6a; // OP_RETURN
  script.set(lokadPush, offset);
  offset += lokadPush.length;
  script.set(messagePush, offset);
  
  return script;
}

// ==================== Secp256k1 ====================

import * as secp from 'https://esm.sh/@noble/secp256k1@2.1.0';

async function getPublicKey(privateKey: Uint8Array, compressed: boolean): Promise<Uint8Array> {
  return secp.getPublicKey(privateKey, compressed);
}

async function signECDSA(messageHash: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  const signature = await secp.signAsync(messageHash, privateKey, { lowS: true });
  const { r, s } = signature;
  const rBytes = bigintToBytes(r);
  const sBytes = bigintToBytes(s);
  
  const rLen = rBytes.length + (rBytes[0] >= 0x80 ? 1 : 0);
  const sLen = sBytes.length + (sBytes[0] >= 0x80 ? 1 : 0);
  const totalLen = 4 + rLen + sLen;
  
  const der = new Uint8Array(2 + totalLen);
  let pos = 0;
  der[pos++] = 0x30;
  der[pos++] = totalLen;
  der[pos++] = 0x02;
  der[pos++] = rLen;
  if (rBytes[0] >= 0x80) der[pos++] = 0x00;
  der.set(rBytes, pos); pos += rBytes.length;
  der[pos++] = 0x02;
  der[pos++] = sLen;
  if (sBytes[0] >= 0x80) der[pos++] = 0x00;
  der.set(sBytes, pos);
  
  return der;
}

function bigintToBytes(n: bigint): Uint8Array {
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  return bytes.slice(start);
}

// ==================== Transaction Building ====================

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

interface UTXO {
  outpoint: { txid: string; outIdx: number };
  blockHeight: number;
  isCoinbase: boolean;
  value: string;
  isFinal: boolean;
  token?: any;
}

async function bip143Sighash(
  inputs: TxInput[],
  outputs: TxOutput[],
  inputIndex: number,
  hashType: number
): Promise<Uint8Array> {
  const input = inputs[inputIndex];
  
  const prevoutsData = new Uint8Array(inputs.length * 36);
  for (let i = 0; i < inputs.length; i++) {
    prevoutsData.set(fromHex(reverseHex(inputs[i].txid)), i * 36);
    new DataView(prevoutsData.buffer).setUint32(i * 36 + 32, inputs[i].vout, true);
  }
  const hashPrevouts = await hash256(prevoutsData);
  
  const sequenceData = new Uint8Array(inputs.length * 4);
  for (let i = 0; i < inputs.length; i++) {
    new DataView(sequenceData.buffer).setUint32(i * 4, 0xffffffff, true);
  }
  const hashSequence = await hash256(sequenceData);
  
  const outputParts: Uint8Array[] = [];
  for (const output of outputs) {
    const valueBuf = writeUint64LE(output.value);
    const scriptLen = encodeVarInt(output.scriptPubKey.length);
    const part = new Uint8Array(valueBuf.length + scriptLen.length + output.scriptPubKey.length);
    part.set(valueBuf, 0);
    part.set(scriptLen, valueBuf.length);
    part.set(output.scriptPubKey, valueBuf.length + scriptLen.length);
    outputParts.push(part);
  }
  const outputsData = new Uint8Array(outputParts.reduce((a, b) => a + b.length, 0));
  let offset = 0;
  for (const part of outputParts) {
    outputsData.set(part, offset);
    offset += part.length;
  }
  const hashOutputs = await hash256(outputsData);
  
  const outpoint = new Uint8Array(36);
  outpoint.set(fromHex(reverseHex(input.txid)), 0);
  new DataView(outpoint.buffer).setUint32(32, input.vout, true);
  
  const scriptCode = new Uint8Array(26);
  scriptCode[0] = 0x19;
  scriptCode.set(input.scriptPubKey, 1);
  
  const preimage = new Uint8Array(4 + 32 + 32 + 36 + scriptCode.length + 8 + 4 + 32 + 4 + 4);
  let pos = 0;
  
  new DataView(preimage.buffer).setUint32(pos, 2, true); pos += 4;
  preimage.set(hashPrevouts, pos); pos += 32;
  preimage.set(hashSequence, pos); pos += 32;
  preimage.set(outpoint, pos); pos += 36;
  preimage.set(scriptCode, pos); pos += scriptCode.length;
  preimage.set(writeUint64LE(input.value), pos); pos += 8;
  new DataView(preimage.buffer).setUint32(pos, 0xffffffff, true); pos += 4;
  preimage.set(hashOutputs, pos); pos += 32;
  new DataView(preimage.buffer).setUint32(pos, 0, true); pos += 4;
  new DataView(preimage.buffer).setUint32(pos, hashType, true);
  
  return hash256(preimage);
}

async function buildSignedTransaction(
  inputs: TxInput[],
  outputs: TxOutput[],
  privateKey: Uint8Array,
  compressed: boolean
): Promise<Uint8Array> {
  const publicKey = await getPublicKey(privateKey, compressed);
  const SIGHASH_ALL_FORKID = 0x41;
  
  const signatures: Uint8Array[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const sighash = await bip143Sighash(inputs, outputs, i, SIGHASH_ALL_FORKID);
    const sig = await signECDSA(sighash, privateKey);
    const sigWithType = new Uint8Array(sig.length + 1);
    sigWithType.set(sig);
    sigWithType[sig.length] = SIGHASH_ALL_FORKID;
    signatures.push(sigWithType);
  }
  
  const txParts: Uint8Array[] = [];
  
  txParts.push(writeUint32LE(2));
  txParts.push(encodeVarInt(inputs.length));
  
  for (let i = 0; i < inputs.length; i++) {
    txParts.push(fromHex(reverseHex(inputs[i].txid)));
    txParts.push(writeUint32LE(inputs[i].vout));
    
    const scriptSig = new Uint8Array(1 + signatures[i].length + 1 + publicKey.length);
    let pos = 0;
    scriptSig[pos++] = signatures[i].length;
    scriptSig.set(signatures[i], pos); pos += signatures[i].length;
    scriptSig[pos++] = publicKey.length;
    scriptSig.set(publicKey, pos);
    
    txParts.push(encodeVarInt(scriptSig.length));
    txParts.push(scriptSig);
    txParts.push(writeUint32LE(0xffffffff));
  }
  
  txParts.push(encodeVarInt(outputs.length));
  
  for (const output of outputs) {
    txParts.push(writeUint64LE(output.value));
    txParts.push(encodeVarInt(output.scriptPubKey.length));
    txParts.push(output.scriptPubKey);
  }
  
  txParts.push(writeUint32LE(0));
  
  const totalLength = txParts.reduce((a, b) => a + b.length, 0);
  const rawTx = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of txParts) {
    rawTx.set(part, offset);
    offset += part.length;
  }
  
  return rawTx;
}

async function getUTXOs(address: string): Promise<UTXO[]> {
  const addressHash = getAddressHash(address);
  if (!addressHash) return [];
  
  try {
    const scriptUtxos = await chronik.script('p2pkh', addressHash).utxos();
    
    if (scriptUtxos && scriptUtxos.utxos && scriptUtxos.utxos.length > 0) {
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
    
    return [];
  } catch (error) {
    console.error('getUTXOs error:', error);
    return [];
  }
}

async function broadcastTransaction(rawTx: Uint8Array): Promise<string | null> {
  const txHex = toHex(rawTx);
  
  try {
    const result = await chronik.broadcastTx(txHex);
    return result.txid;
  } catch (error) {
    console.error('Broadcast error:', error);
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
    const { address, amount_xec, reason } = await req.json();
    
    if (!address || !amount_xec) {
      return new Response(
        JSON.stringify({ error: 'Missing address or amount_xec' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountSats = Math.round(amount_xec * 100); // Convert XEC to satoshis
    console.log(`Sending refund: ${amount_xec} XEC (${amountSats} sats) to ${address}`);
    console.log(`Reason: ${reason || 'Manual refund'}`);

    // Validate address
    const recipientHash = cashAddrToHash160(address);
    if (!recipientHash) {
      return new Response(
        JSON.stringify({ error: 'Invalid eCash address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load escrow wallet
    const escrowWIF = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');
    if (!escrowWIF) throw new Error('ESCROW_PRIVATE_KEY_WIF not configured');

    const decoded = decodeWIF(escrowWIF);
    if (!decoded) throw new Error('Failed to decode escrow private key');

    const { privateKey, compressed } = decoded;
    const escrowHash = cashAddrToHash160(ESCROW_ADDRESS);
    if (!escrowHash) throw new Error('Invalid escrow address');

    const escrowScript = createP2PKHScript(escrowHash);

    // Get UTXOs
    const utxos = await getUTXOs(ESCROW_ADDRESS);
    console.log(`Found ${utxos.length} UTXOs in escrow`);

    if (utxos.length === 0) throw new Error('No UTXOs available');

    // Calculate totals
    let totalAvailable = 0;
    const validUtxos = utxos.filter(u => !u.token);
    for (const utxo of validUtxos) {
      totalAvailable += parseInt(utxo.value);
    }

    // Fee calculation: ~1 sat/byte minimum, estimate based on tx size
    // Base: 10 bytes + inputs (180 each) + outputs (34 each)
    const estimatedSize = 10 + 180 + (3 * 34) + 50; // 1 input, 3 outputs, buffer
    const estimatedFee = Math.max(400, estimatedSize); // Minimum 400 sats to be safe
    
    console.log(`Refund: ${amountSats} sats, Fee: ~${estimatedFee}, Available: ${totalAvailable}`);

    if (totalAvailable < amountSats + estimatedFee) {
      throw new Error(`Insufficient funds: need ${amountSats + estimatedFee}, have ${totalAvailable}`);
    }

    // Build inputs
    const inputs: TxInput[] = [];
    let inputTotal = 0n;
    const needed = BigInt(amountSats + estimatedFee);
    
    for (const utxo of validUtxos) {
      inputs.push({
        txid: utxo.outpoint.txid,
        vout: utxo.outpoint.outIdx,
        value: BigInt(utxo.value),
        scriptPubKey: escrowScript,
      });
      inputTotal += BigInt(utxo.value);
      if (inputTotal >= needed) break;
    }

    // Build outputs
    const outputs: TxOutput[] = [];
    
    // Refund output
    outputs.push({
      value: BigInt(amountSats),
      scriptPubKey: createP2PKHScript(recipientHash),
    });

    // Add OP_RETURN message
    const refundMessage = reason || 'Refund from eCash Pulse';
    const opReturnScript = createCashtabMessageScript(refundMessage);
    outputs.push({
      value: 0n,
      scriptPubKey: opReturnScript,
    });

    // Calculate change
    const outputTotal = outputs.reduce((a, b) => a + b.value, 0n);
    const change = inputTotal - outputTotal - BigInt(estimatedFee);
    
    if (change > 546n) {
      outputs.push({
        value: change,
        scriptPubKey: escrowScript,
      });
    }

    console.log(`Building refund tx: ${inputs.length} inputs, ${outputs.length} outputs`);

    // Build and sign transaction
    const rawTx = await buildSignedTransaction(inputs, outputs, privateKey, compressed);
    console.log(`Refund transaction built: ${rawTx.length} bytes`);

    // Broadcast
    const txid = await broadcastTransaction(rawTx);
    if (!txid) throw new Error('Failed to broadcast refund transaction');

    console.log(`Refund transaction broadcast: ${txid}`);

    // Log the refund in audit
    await supabase.from('bet_audit_log').insert({
      event_type: 'manual_refund_sent',
      metadata: {
        reason: reason || 'Manual refund',
        recipient_address: address,
        amount_xec: amount_xec,
        amount_sats: amountSats,
        txid,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Refund of ${amount_xec} XEC sent`,
        txid,
        amount_xec,
        address,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Refund error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to send refund',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
