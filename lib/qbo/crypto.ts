import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM. Key: QBO_TOKEN_KEY, 32 bytes base64 (openssl rand -base64 32).
// Ciphertext format: base64(iv | authTag | data).
function key(): Buffer {
  const k = Buffer.from(process.env.QBO_TOKEN_KEY ?? "", "base64");
  if (k.length !== 32) {
    throw new Error("QBO_TOKEN_KEY must be 32 bytes, base64-encoded");
  }
  return k;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptToken(enc: string): string {
  const raw = Buffer.from(enc, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
