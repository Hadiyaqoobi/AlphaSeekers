/**
 * Phone number encryption utility.
 *
 * BRD §4.2: "WhatsApp numbers stored encrypted; only used for notification delivery."
 *
 * Writes use the shared at-rest key (DATA_ENCRYPTION_KEY) via crypto.ts
 * (AES-256-GCM). This FAILS CLOSED in production: if the key is missing,
 * encryptPhone throws rather than silently persisting a plaintext number.
 * In demo/dev a "plain:" passthrough is used (with a one-time warning).
 *
 * Reads are backward-compatible:
 *  - "v1:" / "plain:"      → new format (crypto.ts)
 *  - "<ivHex>:<enc>:<hmac>" → legacy AES-256-CBC keyed by PHONE_ENCRYPTION_KEY
 *  - anything else          → pre-encryption plaintext, returned as-is
 */
import { createDecipheriv, createHmac } from "crypto";

import { runtime } from "@/lib/runtime";
import { decryptFromRest, encryptToRest } from "@/lib/security/crypto";

const LEGACY_ALGORITHM = "aes-256-cbc";
const LEGACY_KEY_LENGTH = 32;

let warnedPlaintext = false;

function legacyKey(): Buffer | null {
  const raw = process.env.PHONE_ENCRYPTION_KEY;
  if (!raw) return null;

  // Derive a 32-byte key from the env var (matches the historical scheme).
  const hash = createHmac("sha256", "alphaseeker-phone-key").update(raw).digest();
  return hash.subarray(0, LEGACY_KEY_LENGTH);
}

/**
 * Encrypt a phone number for storage.
 *
 * Production without DATA_ENCRYPTION_KEY → throws (fail closed).
 * Demo/dev without a key → "plain:" passthrough plus a one-time warning.
 */
export function encryptPhone(phone: string): string {
  if (!process.env.DATA_ENCRYPTION_KEY && runtime.mode !== "production" && !warnedPlaintext) {
    warnedPlaintext = true;
    console.warn(
      "[AlphaSeekers] PHONE ENCRYPTION: DATA_ENCRYPTION_KEY is not set — phone numbers are stored UNENCRYPTED (dev only).",
    );
  }
  return encryptToRest(phone);
}

/**
 * Decrypt a stored phone number, transparently handling new and legacy formats.
 * Only throws when a legacy value fails its integrity (HMAC) check — a tamper
 * signal we must not swallow.
 */
export function decryptPhone(stored: string): string {
  if (!stored) return stored;

  // New format written by crypto.ts.
  if (stored.startsWith("v1:") || stored.startsWith("plain:")) {
    return decryptFromRest(stored);
  }

  // Legacy AES-256-CBC: "<ivHex>:<enc>:<hmac>".
  const parts = stored.split(":");
  if (parts.length === 3 && /^[0-9a-f]+$/i.test(parts[0])) {
    const key = legacyKey();
    if (key) {
      const [ivHex, data, hmac] = parts;
      const expectedHmac = createHmac("sha256", key).update(ivHex + data).digest("hex");
      if (hmac !== expectedHmac) {
        throw new Error("Phone decryption integrity check failed");
      }
      const iv = Buffer.from(ivHex, "hex");
      const decipher = createDecipheriv(LEGACY_ALGORITHM, key, iv);
      let decrypted = decipher.update(data, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    }
    // No legacy key available — cannot decrypt; fall through and return as-is.
  }

  // Pre-encryption plaintext (stored before encryption was configured).
  return stored;
}
