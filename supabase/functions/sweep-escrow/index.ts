import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChronikClient } from 'https://esm.sh/chronik-client@3.6.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const chronik = new ChronikClient(['https://chronik.e.cash']);
const CUSTODIAL_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

// ==================== Crypto Primitives (same as send-payouts) ====================

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', data);
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
  
  function rotl(x: number, n: number) { return ((x << n) | (x >>> (32 - n))) >>> 0; }
  function f(j: number, x: number, y: number, z: number) {
    if (j < 16) return (x ^ y ^ z) >>> 0;
    if (j < 32) return ((x & y) | (~x & z)) >>> 0;
    if (j < 48) return ((x | ~y) ^ z) >>> 0;
    if (j < 64) return ((x & z) | (y & ~z)) >>> 0;
    return (x ^ (y | ~z)) >>> 0;
  }

  const padded = new Uint8Array(((data.length + 72) & ~63));
  padded.set(data);
  padded[data.length] = 0x80;
  const bits = data.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bits >>> 0, true);
  view.setUint32(padded.length - 4, (bits / 0x100000000) >>> 0, true);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  for (let i = 0; i < padded.length; i += 64) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) w.push(view.getUint32(i + j * 4, true));
    
    let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
    let ar = h0, br = h1, cr = h2, dr = h3, er = h4;
    
    for (let j = 0; j < 80; j++) {
      let t = (al + f(j, bl, cl, dl) + w[R1[j]] + K1[j >>> 4]) >>> 0;
      t = (rotl(t, S1[j]) + el) >>> 0;
      al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
      
      t = (ar + f(79 - j, br, cr, dr) + w[R2[j]] + K2[j >>> 4]) >>> 0;
      t = (rotl(t, S2[j]) + er) >>> 0;
      ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    }
    
    const t2 = (h1 + cl + dr) >>> 0;
    h1 = (h2 + dl + er) >>> 0;
    h2 = (h3 + el + ar) >>> 0;
    h3 = (h4 + al + br) >>> 0;
    h4 = (h0 + bl + cr) >>> 0;
    h0 = t2;
  }

  const result = new Uint8Array(20);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, true); rv.setUint32(4, h1, true); rv.setUint32(8, h2, true);
  rv.setUint32(12, h3, true); rv.setUint32(16, h4, true);
  return result;
}

async function hash160(data: Uint8Array): Promise<Uint8Array> {
  return ripemd160(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}

function toHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  return arr;
}

function reverseHex(hex: string): string {
  return hex.match(/../g)!.reverse().join('');
}

function writeUint32LE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, true);
  return buf;
}

function writeUint64LE(n: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setUint32(0, Number(n & 0xFFFFFFFFn), true);
  view.setUint32(4, Number((n >> 32n) & 0xFFFFFFFFn), true);
  return buf;
}

function encodeVarInt(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) { const b = new Uint8Array(3); b[0] = 0xfd; new DataView(b.buffer).setUint16(1, n, true); return b; }
  const b = new Uint8Array(5); b[0] = 0xfe; new DataView(b.buffer).setUint32(1, n, true); return b;
}

function cashAddrToHash160(address: string): Uint8Array | null {
  const addr = address.replace('ecash:', '');
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data: number[] = [];
  for (const c of addr) { const i = CHARSET.indexOf(c); if (i === -1) return null; data.push(i); }
  let acc = 0, bits = 0;
  const converted: number[] = [];
  for (let i = 0; i < data.length - 8; i++) {
    acc = (acc << 5) | data[i]; bits += 5;
    while (bits >= 8) { bits -= 8; converted.push((acc >> bits) & 0xff); }
  }
  return new Uint8Array(converted.slice(1, 21));
}

function createP2PKHScript(hash160: Uint8Array): Uint8Array {
  const script = new Uint8Array(25);
  script[0] = 0x76; script[1] = 0xa9; script[2] = 0x14;
  script.set(hash160, 3);
  script[23] = 0x88; script[24] = 0xac;
  return script;
}

// secp256k1 params
const P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a % m, m]; let [old_s, s] = [1n, 0n];
  while (r !== 0n) { const q = old_r / r; [old_r, r] = [r, old_r - q * r]; [old_s, s] = [s, old_s - q * s]; }
  return ((old_s % m) + m) % m;
}

function pointAdd(x1: bigint, y1: bigint, x2: bigint, y2: bigint): [bigint, bigint] {
  if (x1 === x2 && y1 === y2) { const s = (3n * x1 * x1 * modInverse(2n * y1, P)) % P; const x3 = (s * s - 2n * x1 + P * 3n) % P; return [x3, (s * (x1 - x3 + P * 2n) - y1 + P * 2n) % P]; }
  const s = ((y2 - y1 + P * 2n) * modInverse((x2 - x1 + P * 2n) % P, P)) % P;
  const x3 = (s * s - x1 - x2 + P * 3n) % P; return [x3, (s * (x1 - x3 + P * 2n) - y1 + P * 2n) % P];
}

function scalarMul(k: bigint, px: bigint, py: bigint): [bigint, bigint] {
  let [rx, ry] = [0n, 0n]; let [qx, qy] = [px, py]; let first = true;
  while (k > 0n) {
    if (k & 1n) { if (first) { [rx, ry] = [qx, qy]; first = false; } else { [rx, ry] = pointAdd(rx, ry, qx, qy); } }
    [qx, qy] = pointAdd(qx, qy, qx, qy); k >>= 1n;
  }
  return [rx, ry];
}

async function getPublicKey(privKey: Uint8Array, compressed: boolean): Promise<Uint8Array> {
  let k = 0n; for (const b of privKey) k = (k << 8n) | BigInt(b);
  const [x, y] = scalarMul(k, Gx, Gy);
  if (compressed) {
    const pub = new Uint8Array(33); pub[0] = y % 2n === 0n ? 0x02 : 0x03;
    const xBytes = x.toString(16).padStart(64, '0'); for (let i = 0; i < 32; i++) pub[i + 1] = parseInt(xBytes.substr(i * 2, 2), 16);
    return pub;
  }
  const pub = new Uint8Array(65); pub[0] = 0x04;
  const xb = x.toString(16).padStart(64, '0'), yb = y.toString(16).padStart(64, '0');
  for (let i = 0; i < 32; i++) { pub[i + 1] = parseInt(xb.substr(i * 2, 2), 16); pub[i + 33] = parseInt(yb.substr(i * 2, 2), 16); }
  return pub;
}

async function signECDSA(hash: Uint8Array, privKey: Uint8Array): Promise<Uint8Array> {
  let d = 0n; for (const b of privKey) d = (d << 8n) | BigInt(b);
  let z = 0n; for (const b of hash) z = (z << 8n) | BigInt(b);
  let r: bigint, s: bigint;
  do {
    const kBytes = new Uint8Array(32); crypto.getRandomValues(kBytes);
    let k = 0n; for (const b of kBytes) k = (k << 8n) | BigInt(b); k = k % (N - 1n) + 1n;
    const [rx] = scalarMul(k, Gx, Gy); r = rx % N; if (r === 0n) continue;
    s = (modInverse(k, N) * (z + r * d)) % N; if (s === 0n) continue;
    if (s > N / 2n) s = N - s;
    break;
  } while (true);
  const rHex = r!.toString(16).padStart(64, '0'), sHex = s!.toString(16).padStart(64, '0');
  const rBytes = fromHex(rHex), sBytes = fromHex(sHex);
  const rLen = rBytes[0] >= 0x80 ? rBytes.length + 1 : rBytes.length;
  const sLen = sBytes[0] >= 0x80 ? sBytes.length + 1 : sBytes.length;
  const sig = new Uint8Array(6 + rLen + sLen);
  sig[0] = 0x30; sig[1] = rLen + sLen + 4;
  sig[2] = 0x02; sig[3] = rLen;
  if (rBytes[0] >= 0x80) { sig[4] = 0; sig.set(rBytes, 5); } else { sig.set(rBytes, 4); }
  const sOff = 4 + rLen;
  sig[sOff] = 0x02; sig[sOff + 1] = sLen;
  if (sBytes[0] >= 0x80) { sig[sOff + 2] = 0; sig.set(sBytes, sOff + 3); } else { sig.set(sBytes, sOff + 2); }
  return sig;
}

interface TxInput { txid: string; vout: number; value: bigint; scriptPubKey: Uint8Array; }
interface TxOutput { value: bigint; scriptPubKey: Uint8Array; }

function getAddressHash(address: string): string | null {
  const hash = cashAddrToHash160(address);
  return hash ? toHex(hash) : null;
}

async function bip143Sighash(inputs: TxInput[], outputs: TxOutput[], inputIndex: number, hashType: number): Promise<Uint8Array> {
  const input = inputs[inputIndex];
  const prevoutParts: Uint8Array[] = [];
  for (const inp of inputs) { const p = new Uint8Array(36); p.set(fromHex(reverseHex(inp.txid)), 0); new DataView(p.buffer).setUint32(32, inp.vout, true); prevoutParts.push(p); }
  const prevoutsData = new Uint8Array(prevoutParts.reduce((a, b) => a + b.length, 0));
  let off = 0; for (const p of prevoutParts) { prevoutsData.set(p, off); off += p.length; }
  const hashPrevouts = await hash256(prevoutsData);
  const sequenceData = new Uint8Array(inputs.length * 4);
  for (let i = 0; i < inputs.length; i++) new DataView(sequenceData.buffer).setUint32(i * 4, 0xffffffff, true);
  const hashSequence = await hash256(sequenceData);
  const outputParts: Uint8Array[] = [];
  for (const output of outputs) { const v = writeUint64LE(output.value); const sl = encodeVarInt(output.scriptPubKey.length); const p = new Uint8Array(v.length + sl.length + output.scriptPubKey.length); p.set(v, 0); p.set(sl, v.length); p.set(output.scriptPubKey, v.length + sl.length); outputParts.push(p); }
  const outputsData = new Uint8Array(outputParts.reduce((a, b) => a + b.length, 0));
  off = 0; for (const p of outputParts) { outputsData.set(p, off); off += p.length; }
  const hashOutputs = await hash256(outputsData);
  const outpoint = new Uint8Array(36); outpoint.set(fromHex(reverseHex(input.txid)), 0); new DataView(outpoint.buffer).setUint32(32, input.vout, true);
  const scriptCode = new Uint8Array(26); scriptCode[0] = 0x19; scriptCode.set(input.scriptPubKey, 1);
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

async function buildSignedTransaction(inputs: TxInput[], outputs: TxOutput[], privateKey: Uint8Array, compressed: boolean): Promise<Uint8Array> {
  const SIGHASH_ALL_FORKID = 0x41;
  const signatures: Uint8Array[] = [];
  const publicKeys: Uint8Array[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const pubKey = await getPublicKey(privateKey, compressed);
    publicKeys.push(pubKey);
    const sighash = await bip143Sighash(inputs, outputs, i, SIGHASH_ALL_FORKID);
    const sig = await signECDSA(sighash, privateKey);
    const sigWithType = new Uint8Array(sig.length + 1); sigWithType.set(sig); sigWithType[sig.length] = SIGHASH_ALL_FORKID;
    signatures.push(sigWithType);
  }
  const txParts: Uint8Array[] = [];
  txParts.push(writeUint32LE(2));
  txParts.push(encodeVarInt(inputs.length));
  for (let i = 0; i < inputs.length; i++) {
    txParts.push(fromHex(reverseHex(inputs[i].txid)));
    txParts.push(writeUint32LE(inputs[i].vout));
    const pubKey = publicKeys[i];
    const scriptSig = new Uint8Array(1 + signatures[i].length + 1 + pubKey.length);
    let p = 0; scriptSig[p++] = signatures[i].length; scriptSig.set(signatures[i], p); p += signatures[i].length; scriptSig[p++] = pubKey.length; scriptSig.set(pubKey, p);
    txParts.push(encodeVarInt(scriptSig.length)); txParts.push(scriptSig);
    txParts.push(writeUint32LE(0xffffffff));
  }
  txParts.push(encodeVarInt(outputs.length));
  for (const output of outputs) { txParts.push(writeUint64LE(output.value)); txParts.push(encodeVarInt(output.scriptPubKey.length)); txParts.push(output.scriptPubKey); }
  txParts.push(writeUint32LE(0));
  const totalLength = txParts.reduce((a, b) => a + b.length, 0);
  const rawTx = new Uint8Array(totalLength);
  let offset = 0; for (const part of txParts) { rawTx.set(part, offset); offset += part.length; }
  return rawTx;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prediction_id, admin_password } = await req.json();
    
    // Admin auth - check against stored secret
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

    // Get prediction escrow details
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

    // Calculate fee
    const estimatedFee = BigInt(10 + inputs.length * 180 + 34);
    const sendAmount = totalValue - estimatedFee;

    if (sendAmount < 546n) {
      return new Response(JSON.stringify({ error: `Amount too small to sweep: ${totalValue} sats` }), { status: 400, headers: corsHeaders });
    }

    // Build output to custodial wallet
    const custodialHash = cashAddrToHash160(CUSTODIAL_ADDRESS)!;
    const outputs: TxOutput[] = [{
      value: sendAmount,
      scriptPubKey: createP2PKHScript(custodialHash),
    }];

    console.log(`Sweeping ${totalValue} sats (${utxos.length} UTXOs) from ${escrowAddress} to custodial. Fee: ${estimatedFee}`);

    const rawTx = await buildSignedTransaction(inputs, outputs, privateKey, compressed);

    // Broadcast
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
