import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS: crypto.ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS);
  return ["scrypt", salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) {
    return false;
  }

  const [scheme, saltB64, hashB64] = stored.split("$");

  if (scheme !== "scrypt" || !saltB64 || !hashB64) {
    return false;
  }

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, salt, expected.length, SCRYPT_OPTIONS);
  return crypto.timingSafeEqual(expected, actual);
}

