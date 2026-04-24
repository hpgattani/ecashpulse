// Canonical eCash address normalization using ecashaddrjs (per eCash SKILLS.md).
// PayButton sometimes returns sender as an object { address, amount } instead of a
// string, which crashes server code that calls .trim() on it. This helper accepts
// any shape and returns a validated, lowercase `ecash:q...` string — or null.
import { decodeCashAddress, encodeCashAddress } from 'ecashaddrjs';

export type AddressLike =
  | string
  | { address?: string; addr?: string; cashAddress?: string }
  | null
  | undefined;

/**
 * Coerce an unknown PayButton/user input into a string address (no validation).
 */
export function coerceAddressString(input: AddressLike): string | null {
  if (!input) return null;
  if (typeof input === 'string') return input;
  if (typeof input === 'object') {
    const v =
      (input as Record<string, unknown>).address ??
      (input as Record<string, unknown>).addr ??
      (input as Record<string, unknown>).cashAddress;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

/**
 * Normalize any input into a canonical lowercase `ecash:q...` address.
 * Returns null if the input is not a valid eCash address.
 */
export function normalizeEcashAddress(input: AddressLike): string | null {
  const raw = coerceAddressString(input);
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const { prefix, type, hash } = decodeCashAddress(trimmed);
    // Only accept eCash mainnet addresses
    if (prefix !== 'ecash') return null;
    return encodeCashAddress('ecash', type, hash).toLowerCase();
  } catch {
    return null;
  }
}

export function isValidEcashAddress(input: AddressLike): boolean {
  return normalizeEcashAddress(input) !== null;
}
