import "server-only";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

/**
 * AES-256-GCM encryption for payment-gateway secret API keys.
 *
 * Keys are stored encrypted at rest in `ShopPaymentGateway.secretKeyEncrypted`
 * and `webhookSecretEncrypted`. Decryption happens server-side only when we
 * need to call the gateway (e.g. test connection, charge a card, verify a
 * webhook). The plaintext key NEVER leaves the server boundary — the
 * dashboard UI receives a masked version (`pk_test_••••5GqLP`).
 *
 * Format: `v1:<iv-hex>:<auth-tag-hex>:<ciphertext-hex>`
 *
 * `v1` prefix lets us migrate to a newer scheme later without breaking
 * old rows — a future encrypt() can emit `v2:` and decrypt() handles both.
 *
 * The encryption key is derived from `PAYMENT_GATEWAY_ENCRYPTION_KEY`
 * (32+ random chars) via scrypt — so even if the env value is short or
 * has low entropy, the derived 256-bit key is uniform. Rotating the env
 * value invalidates every existing row; do not rotate without a re-encrypt
 * migration.
 */

const VERSION = "v1";

function getDerivedKey(): Buffer {
  const secret = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "PAYMENT_GATEWAY_ENCRYPTION_KEY env var not set (need ≥16 chars). " +
        "Generate with: openssl rand -base64 32",
    );
  }
  // scryptSync is deterministic — same env → same derived key. The salt is
  // a fixed literal because we WANT determinism; the per-row IV provides
  // ciphertext uniqueness.
  return scryptSync(secret, "salepage-payment-gateway-v1", 32);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) throw new Error("encryptSecret: plaintext is empty");
  const key = getDerivedKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("hex"),
    tag.toString("hex"),
    enc.toString("hex"),
  ].join(":");
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) throw new Error("decryptSecret: ciphertext is empty");
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(`decryptSecret: unknown format (expected v1, got '${parts[0]}')`);
  }
  const [, ivHex, tagHex, dataHex] = parts;
  const key = getDerivedKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** Mask a key for display — keeps a small prefix + last 4 chars so the
 *  seller can verify it's the right one without exposing the full value. */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return key[0] + "•".repeat(key.length - 1);
  const prefixLen = key.startsWith("sk_") || key.startsWith("pk_") ? 7 : 4;
  const prefix = key.slice(0, Math.min(prefixLen, key.length - 4));
  const tail = key.slice(-4);
  return `${prefix}${"•".repeat(8)}${tail}`;
}
