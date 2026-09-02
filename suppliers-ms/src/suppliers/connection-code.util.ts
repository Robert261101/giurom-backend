/**
 * Crockford-like Base32 alphabet without easily confused chars (0/O/1/I).
 * Uppercase only; ~12 chars ≈ 60 bits of entropy.
 */
export const SUPPLIER_CONNECTION_CODE_ALPHABET =
  '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export const SUPPLIER_CONNECTION_CODE_LENGTH = 12;

export function normalizeSupplierConnectionCode(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const normalized = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]/g, '');
  return normalized.length > 0 ? normalized : null;
}

export function isValidSupplierConnectionCodeFormat(code: string): boolean {
  if (code.length !== SUPPLIER_CONNECTION_CODE_LENGTH) return false;
  for (let i = 0; i < code.length; i += 1) {
    if (!SUPPLIER_CONNECTION_CODE_ALPHABET.includes(code[i]!)) return false;
  }
  return true;
}

/**
 * Cryptographically secure random connection code (not an auth credential).
 */
export function generateSupplierConnectionCode(
  randomBytes: (size: number) => Uint8Array = defaultRandomBytes,
): string {
  const alphabet = SUPPLIER_CONNECTION_CODE_ALPHABET;
  const bytes = randomBytes(SUPPLIER_CONNECTION_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < SUPPLIER_CONNECTION_CODE_LENGTH; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length]!;
  }
  return out;
}

function defaultRandomBytes(size: number): Uint8Array {
  // Lazy require so unit tests can inject a stub without Node crypto.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomBytes } = require('crypto') as typeof import('crypto');
  return randomBytes(size);
}
