import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY env var must be a 64-character hex string (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

export function encryptConfig(plainObject: Record<string, unknown>): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(plainObject);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptConfig(ciphertext: string): Record<string, unknown> {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format.");
  const [ivHex, tagHex, encHex] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted =
    decipher.update(Buffer.from(encHex, "hex")).toString("utf8") +
    decipher.final("utf8");
  return JSON.parse(decrypted) as Record<string, unknown>;
}

export function isEncrypted(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.split(":").length === 3 &&
    /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(value)
  );
}

export function encryptionAvailable(): boolean {
  const hex = process.env.ENCRYPTION_KEY;
  return !!hex && hex.length === 64;
}
