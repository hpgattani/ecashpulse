export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Invalid hex input');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toBits(data: Uint8Array, bits: number): number[] {
  const result: number[] = [];
  for (const byte of data) {
    for (let i = bits - 1; i >= 0; i--) {
      result.push((byte >> i) & 1);
    }
  }
  return result;
}

function convertBits(bits: number[], toBitSize: number): Uint8Array {
  const result: number[] = [];
  let acc = 0;
  let accBits = 0;

  for (const bit of bits) {
    acc = (acc << 1) | bit;
    accBits++;
    if (accBits === toBitSize) {
      result.push(acc);
      acc = 0;
      accBits = 0;
    }
  }

  if (accBits > 0) {
    result.push(acc << (toBitSize - accBits));
  }

  return new Uint8Array(result);
}

function prefixToUint5Array(prefix: string): Uint8Array {
  const result = new Uint8Array(prefix.length);
  for (let i = 0; i < prefix.length; i++) {
    result[i] = prefix.charCodeAt(i) & 31;
  }
  return result;
}

function polymod(v: Uint8Array): bigint {
  const GENERATORS = [
    0x98f2bc8e61n,
    0x79b76d99e2n,
    0xf33e5fb3c4n,
    0xae2eabe2a8n,
    0x1e4f43e470n,
  ];

  let c = 1n;
  for (const d of v) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    for (let i = 0; i < 5; i++) {
      if ((c0 >> BigInt(i)) & 1n) {
        c ^= GENERATORS[i];
      }
    }
  }

  return c ^ 1n;
}

function checksumToUint5Array(checksum: bigint): Uint8Array {
  const result = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    result[7 - i] = Number((checksum >> BigInt(i * 5)) & 31n);
  }
  return result;
}

function encodeCashAddr(prefix: string, type: 0 | 1, hash: Uint8Array): string {
  const versionByte = (type << 3) | 0; // 160-bit hash size
  const payload = new Uint8Array(1 + hash.length);
  payload[0] = versionByte;
  payload.set(hash, 1);

  const payloadBits = toBits(payload, 8);
  const paddedBits = convertBits(payloadBits, 5);

  const prefixData = prefixToUint5Array(prefix);
  const checksumInput = new Uint8Array(prefixData.length + 1 + paddedBits.length + 8);
  checksumInput.set(prefixData, 0);
  checksumInput[prefixData.length] = 0;
  checksumInput.set(paddedBits, prefixData.length + 1);

  const checksum = polymod(checksumInput);
  const checksumBytes = checksumToUint5Array(checksum);

  const combined = new Uint8Array(paddedBits.length + checksumBytes.length);
  combined.set(paddedBits, 0);
  combined.set(checksumBytes, paddedBits.length);

  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  let encoded = `${prefix}:`;
  for (const b of combined) {
    encoded += CHARSET[b];
  }
  return encoded;
}

export function hash160ToCashAddr(hash: Uint8Array): string {
  if (hash.length !== 20) {
    throw new Error('hash160 must be 20 bytes');
  }
  return encodeCashAddr('ecash', 0, hash);
}

export function scriptHexToCashAddr(scriptHex: string): string | null {
  const script = scriptHex.trim().toLowerCase();

  try {
    if (script.startsWith('76a914') && script.endsWith('88ac') && script.length === 50) {
      const hash = hexToBytes(script.slice(6, 46));
      return encodeCashAddr('ecash', 0, hash);
    }

    if (script.startsWith('a914') && script.endsWith('87') && script.length === 46) {
      const hash = hexToBytes(script.slice(4, 44));
      return encodeCashAddr('ecash', 1, hash);
    }
  } catch {
    return null;
  }

  return null;
}
