import crypto from "crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:";

function getKey(): Buffer | null {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

/** Encrypts sensitive PII (passport numbers). Pass-through when ENCRYPTION_KEY is unset (dev). */
export function encryptField(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/** Decrypts a field encrypted with encryptField. Returns as-is if not encrypted. */
export function decryptField(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) return value;
  const payload = value.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return value;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
