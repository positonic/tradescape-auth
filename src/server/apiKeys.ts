import crypto from "crypto";

/**
 * API keys for headless clients (CLI, SDK, MCP servers).
 *
 * The plaintext key is shown once at creation and never stored. We keep a
 * SHA-256 hash for verification plus a short unique prefix so a lookup is a
 * single indexed query rather than a scan-and-compare over every hash.
 *
 * Key shape: ts_live_<prefix><secret>  (prefix 8 chars, secret 32 chars)
 */

export const API_KEY_PREFIX = "ts_live_";
const PREFIX_LENGTH = 8;
const SECRET_LENGTH = 32;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomString(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export interface GeneratedApiKey {
  /** Full plaintext key — returned to the caller once, never persisted. */
  key: string;
  /** Indexed lookup handle, safe to display. */
  prefix: string;
  /** SHA-256 of the full plaintext key. */
  hashedKey: string;
}

export function generateApiKey(): GeneratedApiKey {
  const prefix = randomString(PREFIX_LENGTH);
  const secret = randomString(SECRET_LENGTH);
  const key = `${API_KEY_PREFIX}${prefix}${secret}`;

  return { key, prefix, hashedKey: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Splits a presented key into its lookup prefix and hash. Returns null when the
 * string is not shaped like one of our keys, so callers can skip the DB hit.
 */
export function parseApiKey(
  key: string,
): { prefix: string; hashedKey: string } | null {
  if (!key.startsWith(API_KEY_PREFIX)) return null;

  const body = key.slice(API_KEY_PREFIX.length);
  if (body.length !== PREFIX_LENGTH + SECRET_LENGTH) return null;

  return {
    prefix: body.slice(0, PREFIX_LENGTH),
    hashedKey: hashApiKey(key),
  };
}

/** Constant-time compare for two hex digests of equal length. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Display form for a stored key: `ts_live_abcd1234…` */
export function maskApiKey(prefix: string): string {
  return `${API_KEY_PREFIX}${prefix}${"…"}`;
}
