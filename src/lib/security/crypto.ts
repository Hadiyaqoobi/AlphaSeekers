/**
 * Application-level encryption at rest.
 *
 * AES-256-GCM (authenticated encryption) keyed by DATA_ENCRYPTION_KEY, a
 * base64-encoded 32-byte (256-bit) key. Used to encrypt sensitive fields
 * (phone numbers, and any other PII a bundle needs to persist) so a database
 * dump alone does not leak plaintext.
 *
 * Output format: "v1:<ivB64>:<tagB64>:<ctB64>"
 *
 * Key policy:
 *  - If DATA_ENCRYPTION_KEY is missing in PRODUCTION, we FAIL CLOSED (throw) so
 *    we never silently write plaintext to a production database.
 *  - In demo/dev we return a "plain:<value>" passthrough (with the same shape
 *    round-tripping through decryptFromRest) so local development works without
 *    provisioning a key.
 *
 * Generate a key with:  openssl rand -base64 32
 */
import crypto from "node:crypto";

import { runtime } from "@/lib/runtime";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256-bit
const IV_LENGTH = 12; // 96-bit nonce, the standard/recommended size for GCM
const PLAIN_PREFIX = "plain:";
const VERSION = "v1";

/**
 * Resolve the 32-byte key from DATA_ENCRYPTION_KEY, or null if unset.
 * Throws if the key is present but not a valid 32-byte base64 value — a
 * misconfigured key must never be treated as "absent" and silently downgraded.
 */
function getKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    return null;
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `DATA_ENCRYPTION_KEY must be a base64-encoded ${KEY_LENGTH}-byte key (got ${key.length} bytes).`,
    );
  }
  return key;
}

function missingKeyError(): Error {
  return new Error(
    "DATA_ENCRYPTION_KEY is not set. It is required in production to encrypt data at rest.",
  );
}

export function encryptToRest(plaintext: string): string {
  const key = getKey();

  if (!key) {
    if (runtime.mode === "production") {
      throw missingKeyError();
    }
    // Dev/demo passthrough — clearly marked so it is never confused with ciphertext.
    return `${PLAIN_PREFIX}${plaintext}`;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptFromRest(value: string): string {
  if (value.startsWith(PLAIN_PREFIX)) {
    if (runtime.mode === "production") {
      // A dev passthrough value must never be honoured in production.
      throw new Error("Refusing to read an unencrypted 'plain:' value in production.");
    }
    return value.slice(PLAIN_PREFIX.length);
  }

  const key = getKey();
  if (!key) {
    if (runtime.mode === "production") {
      throw missingKeyError();
    }
    // Dev/demo without a key and without a plain: prefix — nothing we can do,
    // return the value untouched.
    return value;
  }

  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed ciphertext: expected 'v1:<iv>:<tag>:<ct>'.");
  }

  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
