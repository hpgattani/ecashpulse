import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChronikClient } from 'https://esm.sh/chronik-client@3.6.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Chronik client for eCash - takes array of URLs
const chronik = new ChronikClient(['https://chronik.e.cash']);
const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

// ==================== Crypto Primitives ====================

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

// SHA256 hash
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(hash);
}

// Double SHA256
async function hash256(data: Uint8Array): Promise<Uint8Array> {
  return sha256(await sha256(data));
}

// RIPEMD160 (manual implementation since not in Web Crypto)
function ripemd160(data: Uint8Array): Uint8Array {
  const K1 = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  const K2 = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
  const R1 = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
  const R2 = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
  const S1 = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
  const S2 = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];

  const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;
  
  // Pad message
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

// Hash160 = RIPEMD160(SHA256(data))
async function hash160(data: Uint8Array): Promise<Uint8Array> {
  return ripemd160(await sha256(data));
}

// Hex utilities
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

// Variable length integer encoding
function encodeVarInt(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    new DataView(buf.buffer).setUint16(1, n, true);
    return buf;
  }
  if (n <= 0xffffffff) {
    const buf = new Uint8Array(5);
    buf[0] = 0xfe;
    new DataView(buf.buffer).setUint32(1, n, true);
    return buf;
  }
  const buf = new Uint8Array(9);
  buf[0] = 0xff;
  new DataView(buf.buffer).setBigUint64(1, BigInt(n), true);
  return buf;
}

// Write uint32 little-endian
function writeUint32LE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, true);
  return buf;
}

// Write uint64 little-endian
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
    
    // Count leading zeros
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
  
  // WIF: version(1) + privkey(32) + [compressed(1)] + checksum(4)
  if (decoded.length === 37) {
    // Uncompressed
    return { privateKey: decoded.slice(1, 33), compressed: false };
  } else if (decoded.length === 38 && decoded[33] === 0x01) {
    // Compressed
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

// Create P2PKH scriptPubKey
function createP2PKHScript(hash160: Uint8Array): Uint8Array {
  // OP_DUP OP_HASH160 <20 bytes> OP_EQUALVERIFY OP_CHECKSIG
  const script = new Uint8Array(25);
  script[0] = 0x76; // OP_DUP
  script[1] = 0xa9; // OP_HASH160
  script[2] = 0x14; // Push 20 bytes
  script.set(hash160, 3);
  script[23] = 0x88; // OP_EQUALVERIFY
  script[24] = 0xac; // OP_CHECKSIG
  return script;
}

// Create OP_RETURN script with Cashtab message
function createCashtabMessageScript(message: string): Uint8Array {
  // Cashtab LOKAD prefix: 00746162 (hex) = \0tab
  const CASHTAB_LOKAD = new Uint8Array([0x00, 0x74, 0x61, 0x62]);
  
  // Encode message as UTF-8
  const messageBytes = new TextEncoder().encode(message);
  
  // Helper to create push op for data
  function pushBytesOp(data: Uint8Array): Uint8Array {
    if (data.length <= 75) {
      // OP_PUSHDATA with length prefix
      const result = new Uint8Array(1 + data.length);
      result[0] = data.length;
      result.set(data, 1);
      return result;
    } else if (data.length <= 255) {
      // OP_PUSHDATA1
      const result = new Uint8Array(2 + data.length);
      result[0] = 0x4c; // OP_PUSHDATA1
      result[1] = data.length;
      result.set(data, 2);
      return result;
    } else {
      // OP_PUSHDATA2 for longer messages
      const result = new Uint8Array(3 + data.length);
      result[0] = 0x4d; // OP_PUSHDATA2
      result[1] = data.length & 0xff;
      result[2] = (data.length >> 8) & 0xff;
      result.set(data, 3);
      return result;
    }
  }
  
  // Build script: OP_RETURN <LOKAD> <message>
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

// ==================== Secp256k1 (using noble-secp256k1) ====================

// Import secp256k1 for signing
import * as secp from 'https://esm.sh/@noble/secp256k1@2.1.0';

async function getPublicKey(privateKey: Uint8Array, compressed: boolean): Promise<Uint8Array> {
  return secp.getPublicKey(privateKey, compressed);
}

async function signECDSA(messageHash: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  const signature = await secp.signAsync(messageHash, privateKey, { lowS: true });
  // Convert to DER format
  const { r, s } = signature;
  const rBytes = bigintToBytes(r);
  const sBytes = bigintToBytes(s);
  
  const rLen = rBytes.length + (rBytes[0] >= 0x80 ? 1 : 0);
  const sLen = sBytes.length + (sBytes[0] >= 0x80 ? 1 : 0);
  const totalLen = 4 + rLen + sLen;
  
  const der = new Uint8Array(2 + totalLen);
  let pos = 0;
  der[pos++] = 0x30; // SEQUENCE
  der[pos++] = totalLen;
  der[pos++] = 0x02; // INTEGER
  der[pos++] = rLen;
  if (rBytes[0] >= 0x80) der[pos++] = 0x00;
  der.set(rBytes, pos); pos += rBytes.length;
  der[pos++] = 0x02; // INTEGER
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
  // Remove leading zeros but keep at least one byte
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  return bytes.slice(start);
}

// ==================== Transaction Building (BIP143 Sighash) ====================

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

// BIP143 sighash for eCash (same as BCH)
async function bip143Sighash(
  inputs: TxInput[],
  outputs: TxOutput[],
  inputIndex: number,
  hashType: number
): Promise<Uint8Array> {
  const input = inputs[inputIndex];
  
  // hashPrevouts
  const prevoutsData = new Uint8Array(inputs.length * 36);
  for (let i = 0; i < inputs.length; i++) {
    prevoutsData.set(fromHex(reverseHex(inputs[i].txid)), i * 36);
    new DataView(prevoutsData.buffer).setUint32(i * 36 + 32, inputs[i].vout, true);
  }
  const hashPrevouts = await hash256(prevoutsData);
  
  // hashSequence
  const sequenceData = new Uint8Array(inputs.length * 4);
  for (let i = 0; i < inputs.length; i++) {
    new DataView(sequenceData.buffer).setUint32(i * 4, 0xffffffff, true);
  }
  const hashSequence = await hash256(sequenceData);
  
  // hashOutputs
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
  
  // Build preimage
  const outpoint = new Uint8Array(36);
  outpoint.set(fromHex(reverseHex(input.txid)), 0);
  new DataView(outpoint.buffer).setUint32(32, input.vout, true);
  
  const scriptCode = new Uint8Array(26);
  scriptCode[0] = 0x19; // Push 25 bytes (scriptPubKey length + 1)
  scriptCode.set(input.scriptPubKey, 1);
  
  const preimage = new Uint8Array(
    4 + 32 + 32 + 36 + scriptCode.length + 8 + 4 + 32 + 4 + 4
  );
  let pos = 0;
  
  // nVersion
  new DataView(preimage.buffer).setUint32(pos, 2, true); pos += 4;
  // hashPrevouts
  preimage.set(hashPrevouts, pos); pos += 32;
  // hashSequence  
  preimage.set(hashSequence, pos); pos += 32;
  // outpoint
  preimage.set(outpoint, pos); pos += 36;
  // scriptCode
  preimage.set(scriptCode, pos); pos += scriptCode.length;
  // value
  preimage.set(writeUint64LE(input.value), pos); pos += 8;
  // nSequence
  new DataView(preimage.buffer).setUint32(pos, 0xffffffff, true); pos += 4;
  // hashOutputs
  preimage.set(hashOutputs, pos); pos += 32;
  // nLocktime
  new DataView(preimage.buffer).setUint32(pos, 0, true); pos += 4;
  // sighash type (SIGHASH_ALL | SIGHASH_FORKID)
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
  const SIGHASH_ALL_FORKID = 0x41; // SIGHASH_ALL | SIGHASH_FORKID
  
  // Sign each input
  const signatures: Uint8Array[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const sighash = await bip143Sighash(inputs, outputs, i, SIGHASH_ALL_FORKID);
    const sig = await signECDSA(sighash, privateKey);
    // Append sighash type byte
    const sigWithType = new Uint8Array(sig.length + 1);
    sigWithType.set(sig);
    sigWithType[sig.length] = SIGHASH_ALL_FORKID;
    signatures.push(sigWithType);
  }
  
  // Build raw transaction
  const txParts: Uint8Array[] = [];
  
  // Version
  txParts.push(writeUint32LE(2));
  
  // Input count
  txParts.push(encodeVarInt(inputs.length));
  
  // Inputs
  for (let i = 0; i < inputs.length; i++) {
    // Previous output
    txParts.push(fromHex(reverseHex(inputs[i].txid)));
    txParts.push(writeUint32LE(inputs[i].vout));
    
    // ScriptSig: <sig> <pubkey>
    const scriptSig = new Uint8Array(1 + signatures[i].length + 1 + publicKey.length);
    let pos = 0;
    scriptSig[pos++] = signatures[i].length;
    scriptSig.set(signatures[i], pos); pos += signatures[i].length;
    scriptSig[pos++] = publicKey.length;
    scriptSig.set(publicKey, pos);
    
    txParts.push(encodeVarInt(scriptSig.length));
    txParts.push(scriptSig);
    
    // Sequence
    txParts.push(writeUint32LE(0xffffffff));
  }
  
  // Output count
  txParts.push(encodeVarInt(outputs.length));
  
  // Outputs
  for (const output of outputs) {
    txParts.push(writeUint64LE(output.value));
    txParts.push(encodeVarInt(output.scriptPubKey.length));
    txParts.push(output.scriptPubKey);
  }
  
  // Locktime
  txParts.push(writeUint32LE(0));
  
  // Concatenate all parts
  const totalLength = txParts.reduce((a, b) => a + b.length, 0);
  const rawTx = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of txParts) {
    rawTx.set(part, offset);
    offset += part.length;
  }
  
  return rawTx;
}

// ==================== API Functions (using chronik-client) ====================

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
    
    // chronik-client returns { outputScript, utxos: [...] }
    if (scriptUtxos && scriptUtxos.utxos && scriptUtxos.utxos.length > 0) {
      console.log(`Got ${scriptUtxos.utxos.length} UTXOs`);
      // Log first UTXO structure to understand the data
      const firstUtxo = scriptUtxos.utxos[0];
      console.log(`First UTXO keys: ${Object.keys(firstUtxo).join(', ')}`);
      
      // Map to our UTXO interface - handle BigInt values
      // chronik-client v3+ uses 'sats' (BigInt) for the value
      return scriptUtxos.utxos.map((u: any) => {
        // Try multiple property names: sats (v3+), value, atoms
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

    // Apply platform fee to payouts
    const platformFeePercent = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENT') || '1.0');
    console.log(`Platform fee: ${platformFeePercent}%`);
    
    let totalFees = 0;
    const feesPerRecipient: Map<string, number> = new Map();
    
    for (const recipient of recipients) {
      const originalAmount = recipient.amount;
      const fee = Math.floor(originalAmount * (platformFeePercent / 100));
      const netAmount = originalAmount - fee;
      
      recipient.amount = netAmount;
      feesPerRecipient.set(recipient.userId, fee);
      totalFees += fee;
      
      console.log(`User ${recipient.userId}: Original ${originalAmount} XEC, Fee ${fee} XEC (${platformFeePercent}%), Net ${netAmount} XEC`);
    }
    
    console.log(`Total platform fees collected: ${totalFees} XEC`);

    // Load escrow wallet
    const escrowWIF = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');
    if (!escrowWIF) throw new Error('ESCROW_PRIVATE_KEY_WIF not configured');

    const decoded = decodeWIF(escrowWIF);
    if (!decoded) throw new Error('Failed to decode escrow private key');

    const { privateKey, compressed } = decoded;
    const escrowHash = cashAddrToHash160(ESCROW_ADDRESS);
    if (!escrowHash) throw new Error('Invalid escrow address');

    const escrowScript = createP2PKHScript(escrowHash);
    console.log('Escrow wallet loaded');

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

    const totalPayout = recipients.reduce((sum, r) => sum + r.amount, 0);
    
    // Calculate fee: base + (outputs * 34) + (inputs * 180) + OP_RETURN (~50 bytes)
    const estimatedFee = 500 + (recipients.length * 34) + (validUtxos.length * 180) + 50;
    
    console.log(`Total to pay: ${totalPayout}, Fee: ~${estimatedFee}, Available: ${totalAvailable}`);

    if (totalAvailable < totalPayout + estimatedFee) {
      throw new Error(`Insufficient funds: need ${totalPayout + estimatedFee}, have ${totalAvailable}`);
    }

    // Build inputs
    const inputs: TxInput[] = [];
    let inputTotal = 0n;
    const needed = BigInt(totalPayout + estimatedFee);
    
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

    // Build outputs - payout outputs for winners
    const outputs: TxOutput[] = recipients.map(r => ({
      value: BigInt(r.amount),
      scriptPubKey: createP2PKHScript(cashAddrToHash160(r.address)!),
    }));

    // Add OP_RETURN output with Cashtab message
    const congratsMessage = Deno.env.get('PAYOUT_MESSAGE') || 'Congratulations for winning on eCash Pulse!';
    const opReturnScript = createCashtabMessageScript(congratsMessage);
    outputs.push({
      value: 0n, // OP_RETURN outputs have 0 value
      scriptPubKey: opReturnScript,
    });
    
    console.log(`Added Cashtab message: "${congratsMessage}"`);

    // Calculate change (OP_RETURN already included in outputs)
    const outputTotal = outputs.reduce((a, b) => a + b.value, 0n);
    const change = inputTotal - outputTotal - BigInt(estimatedFee);
    
    if (change > 546n) {
      outputs.push({
        value: change,
        scriptPubKey: escrowScript,
      });
    }

    console.log(`Building tx: ${inputs.length} inputs, ${outputs.length} outputs`);

    // Build and sign transaction
    const rawTx = await buildSignedTransaction(inputs, outputs, privateKey, compressed);
    console.log(`Transaction built: ${rawTx.length} bytes`);

    // Broadcast
    const txid = await broadcastTransaction(rawTx);
    if (!txid) throw new Error('Failed to broadcast payout transaction');

    console.log(`Payout transaction broadcast: ${txid}`);

    // Update bet records with tx hash and platform fee
    const allBetIds = recipients.flatMap(r => r.betIds);
    
    // Update each bet with its corresponding platform fee
    for (const recipient of recipients) {
      const fee = feesPerRecipient.get(recipient.userId) || 0;
      await supabase
        .from('bets')
        .update({ 
          payout_tx_hash: txid,
          platform_fee: fee
        })
        .in('id', recipient.betIds);
    }

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
