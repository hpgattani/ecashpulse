// AES-256-GCM at-rest encryption for escrow private keys.
//
// Storage format (string column `escrow_privkey_encrypted`):
//   - Legacy plaintext:    64-char lowercase hex (raw secp256k1 private key)
//   - Encrypted (v1):      "enc:v1:<base64(iv|ciphertext|tag)>"
//                          iv = 12 random bytes, AES key = SHA-256(ESCROW_KEY_ENCRYPTION_SECRET)
//
// Readers MUST go through `decryptPrivkey` so both formats work.
// Writers MUST go through `encryptPrivkey` so new rows are always encrypted.

import { fromHex, toHex } from './crypto.ts';

const ENC_PREFIX = 'enc:v1:';
const RAW_HEX_RE = /^[0-9a-f]{64}$/i;

function getSecret(): string {
  const secret = Deno.env.get('ESCROW_KEY_ENCRYPTION_SECRET');
  if (!secret || secret.length < 32) {
    throw new Error('ESCROW_KEY_ENCRYPTION_SECRET is not configured');
  }
  return secret;
}

let cachedKey: CryptoKey | null = null;
async function getAesKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = getSecret();
  const keyBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  );
  cachedKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedKey;
}

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function isEncrypted(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(ENC_PREFIX);
}

/** Encrypt a raw hex private key for at-rest storage. */
export async function encryptPrivkey(privkeyHex: string): Promise<string> {
  if (!RAW_HEX_RE.test(privkeyHex)) {
    throw new Error('encryptPrivkey: expected 64-char hex');
  }
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = fromHex(privkeyHex);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  const cipher = new Uint8Array(cipherBuf);
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return ENC_PREFIX + b64encode(out);
}

/** Decrypt a stored value into raw hex. Accepts both encrypted (v1) and legacy plaintext hex. */
export async function decryptPrivkey(stored: string): Promise<string> {
  if (!stored) throw new Error('decryptPrivkey: empty value');
  if (!stored.startsWith(ENC_PREFIX)) {
    // Legacy plaintext hex — return as-is.
    if (!RAW_HEX_RE.test(stored)) {
      throw new Error('decryptPrivkey: unrecognized stored key format');
    }
    return stored.toLowerCase();
  }
  const key = await getAesKey();
  const blob = b64decode(stored.slice(ENC_PREFIX.length));
  if (blob.length < 12 + 16) throw new Error('decryptPrivkey: ciphertext too short');
  const iv = blob.slice(0, 12);
  const cipher = blob.slice(12);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher
  );
  return toHex(new Uint8Array(plainBuf));
}

/**
 * Convenience: given the value currently stored in DB, return both the usable
 * hex key AND (if the stored value was legacy plaintext) a fresh encrypted
 * value the caller can write back to upgrade the row in place.
 */
export async function decryptAndMaybeUpgrade(stored: string): Promise<{
  privkeyHex: string;
  upgradedCiphertext: string | null;
}> {
  const privkeyHex = await decryptPrivkey(stored);
  if (isEncrypted(stored)) {
    return { privkeyHex, upgradedCiphertext: null };
  }
  const upgradedCiphertext = await encryptPrivkey(privkeyHex);
  return { privkeyHex, upgradedCiphertext };
}
