/**
 * Phone number encryption utility.
 *
 * BRD §4.2: "WhatsApp numbers stored encrypted; only used for notification delivery."
 *
 * Uses AES-256-CBC with an HMAC for integrity. The key is derived from
 * PHONE_ENCRYPTION_KEY env var. Falls back to a no-op in development if
 * the key is not set.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer | null {
    const raw = process.env.PHONE_ENCRYPTION_KEY;
    if (!raw) return null;

    // Derive a 32-byte key from the env var using SHA-256
    const hash = createHmac("sha256", "alphaseeker-phone-key").update(raw).digest();
    return hash.subarray(0, KEY_LENGTH);
}

/**
 * Encrypt a phone number. Returns a hex string: iv:encrypted:hmac
 * If PHONE_ENCRYPTION_KEY is not set, returns the phone as-is (dev mode).
 */
export function encryptPhone(phone: string): string {
    const key = getKey();
    if (!key) return phone;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(phone, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Integrity HMAC
    const hmac = createHmac("sha256", key).update(iv.toString("hex") + encrypted).digest("hex");

    return `${iv.toString("hex")}:${encrypted}:${hmac}`;
}

/**
 * Decrypt a phone number. Expects the format iv:encrypted:hmac.
 * If the input doesn't look encrypted (no colons), returns as-is.
 */
export function decryptPhone(encrypted: string): string {
    const key = getKey();
    if (!key) return encrypted;

    const parts = encrypted.split(":");
    if (parts.length !== 3) return encrypted; // Not encrypted, return as-is

    const [ivHex, data, hmac] = parts;

    // Verify HMAC
    const expectedHmac = createHmac("sha256", key).update(ivHex + data).digest("hex");
    if (hmac !== expectedHmac) {
        throw new Error("Phone decryption integrity check failed");
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}
