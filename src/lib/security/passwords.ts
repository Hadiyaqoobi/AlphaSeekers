import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS: crypto.ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

/**
 * Promisified scrypt.
 *
 * scryptSync blocks the Node event loop for the full ~64MB / N=16384 derivation
 * on every login/register/change — under concurrent auth this starves every
 * other request on the instance. The async variant offloads the work to libuv's
 * threadpool so the event loop stays responsive.
 */
function scryptAsync(
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return ["scrypt", salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) {
    return false;
  }

  const [scheme, saltB64, hashB64] = stored.split("$");

  if (scheme !== "scrypt" || !saltB64 || !hashB64) {
    return false;
  }

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, salt, expected.length);

  // Both buffers are the same length (keylen === expected.length), so
  // timingSafeEqual is safe to call and stays constant-time.
  if (actual.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, actual);
}
