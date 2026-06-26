const AUTH_CHALLENGE_TTL_MS = 60 * 60 * 1000;
const AUTH_OP_RETURN_PREFIX = 'ecashpulse-auth';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hmacSha256Hex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length % 2 !== 0 || b.length % 2 !== 0) return false;
  const aBytes = hexToBytes(a);
  const bBytes = hexToBytes(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export function normalizePaymentId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const paymentId = input.trim().toLowerCase();
  if (!/^[0-9a-f]{2,150}$/.test(paymentId) || paymentId.length % 2 !== 0) return null;
  return paymentId;
}

export function authOpReturnForPaymentId(paymentId: string): string {
  return `${AUTH_OP_RETURN_PREFIX}:${paymentId}`;
}

export function extractAuthPaymentIdFromMessage(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const message = input.trim().toLowerCase();
  const prefix = `${AUTH_OP_RETURN_PREFIX}:`;
  if (message.startsWith(prefix)) return normalizePaymentId(message.slice(prefix.length));

  // Some wallets render PayButton OP_RETURN data as human-readable fields like
  // "Data: ecashpulse-auth, Nonce: <hex>" instead of preserving our exact
  // "ecashpulse-auth:<hex>" string. Accept that shape too so the login remains
  // smooth while still requiring the unique per-tab nonce/payment id.
  const match = message.match(/ecashpulse-auth(?:\s*[,;|/-]?\s*(?:nonce|payment[_\s-]*id)?\s*[:=]?\s*|\s*:\s*)([0-9a-f]{2,150})/i);
  return normalizePaymentId(match?.[1]);
}

export async function createAuthChallenge(secret: string): Promise<{
  payment_id: string;
  challenge_token: string;
  expires_at: string;
}> {
  const paymentId = randomHex(16);
  const nonce = randomHex(32);
  const expiresAtMs = Date.now() + AUTH_CHALLENGE_TTL_MS;
  const payload = `v1.${paymentId}.${nonce}.${expiresAtMs}`;
  const signature = await hmacSha256Hex(payload, secret);

  return {
    payment_id: paymentId,
    challenge_token: `${payload}.${signature}`,
    expires_at: new Date(expiresAtMs).toISOString(),
  };
}

export async function verifyAuthChallenge(
  challengeToken: unknown,
  paymentId: string,
  secret: string,
): Promise<{ valid: boolean; error?: string }> {
  if (typeof challengeToken !== 'string') {
    return { valid: false, error: 'Login challenge required' };
  }

  const parts = challengeToken.trim().split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    return { valid: false, error: 'Invalid login challenge' };
  }

  const [, tokenPaymentId, nonce, expiresAtRaw, signature] = parts;
  if (normalizePaymentId(tokenPaymentId) !== paymentId || !/^[0-9a-f]{64}$/.test(nonce)) {
    return { valid: false, error: 'Login challenge does not match this payment' };
  }

  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
    return { valid: false, error: 'Login challenge expired. Please refresh and try again.' };
  }

  if (!/^[0-9a-f]{64}$/.test(signature)) {
    return { valid: false, error: 'Invalid login challenge signature' };
  }

  const payload = parts.slice(0, 4).join('.');
  const expectedSignature = await hmacSha256Hex(payload, secret);
  if (!safeEqualHex(signature, expectedSignature)) {
    return { valid: false, error: 'Invalid login challenge signature' };
  }

  return { valid: true };
}

export function extractPayButtonOpReturn(outputScript: unknown): { rawMessage: string; paymentId: string } | null {
  if (typeof outputScript !== 'string') return null;
  const script = outputScript.trim().toLowerCase();
  if (script.length < 16 || script.length % 2 !== 0) return null;
  if (!/^6a0450415900[0-9a-f]{2}/i.test(script.slice(0, 14))) return null;

  let offset = 16;
  let messageLengthPrefix = script.slice(14, offset);
  if (messageLengthPrefix === '4c') {
    offset += 2;
    messageLengthPrefix = script.slice(16, offset);
  }

  const messageByteLength = parseInt(messageLengthPrefix, 16);
  if (!Number.isFinite(messageByteLength)) return null;

  const afterMessage = offset + messageByteLength * 2;
  if (script.length < afterMessage) return null;

  let rawMessage = '';
  try {
    const messageHex = script.slice(offset, afterMessage);
    const messageBytes = new Uint8Array(messageHex.length / 2);
    for (let i = 0; i < messageBytes.length; i++) {
      messageBytes[i] = parseInt(messageHex.slice(i * 2, i * 2 + 2), 16);
    }
    rawMessage = new TextDecoder().decode(messageBytes);
  } catch {
    rawMessage = '';
  }

  if (script.length < afterMessage + 2) return { rawMessage, paymentId: '' };

  const paymentIdByteLength = parseInt(script.slice(afterMessage, afterMessage + 2), 16);
  if (!Number.isFinite(paymentIdByteLength)) return null;

  const paymentIdStart = afterMessage + 2;
  const paymentIdEnd = paymentIdStart + paymentIdByteLength * 2;
  if (script.length < paymentIdEnd) return { rawMessage, paymentId: '' };

  return { rawMessage, paymentId: script.slice(paymentIdStart, paymentIdEnd).toLowerCase() };
}

export function extractPayButtonPaymentId(outputScript: unknown): string | null {
  const opReturn = extractPayButtonOpReturn(outputScript);
  if (!opReturn) return null;
  return normalizePaymentId(opReturn.paymentId) || extractAuthPaymentIdFromMessage(opReturn.rawMessage);
}

export function extractPaymentIdFromChronikTx(tx: any): string | null {
  for (const output of tx?.outputs || []) {
    const paymentId = extractPayButtonPaymentId(output?.outputScript);
    if (paymentId) return paymentId;
  }
  return null;
}