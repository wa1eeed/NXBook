// ============================================================
// AES-256-GCM encryption for gateway API keys stored at rest
// (CLAUDE.md §7: never store plaintext secrets). Used by the
// payment-gateway layer to encrypt/decrypt per-tenant provider
// credentials. The key comes from ENCRYPTION_KEY (64 hex chars).
// ============================================================
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const KEY_HEX = process.env.ENCRYPTION_KEY ?? ""

function keyBuffer(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 64) {
    throw new Error(
      "ENCRYPTION_KEY env var is missing or too short. Generate with: openssl rand -hex 32",
    )
  }
  return Buffer.from(KEY_HEX, "hex")
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const key = keyBuffer()
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  // format: iv(12):tag(16):ciphertext — base64 encoded
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decryptSecret(ciphertext: string): string {
  const [ivB64, tagB64, encB64] = ciphertext.split(":")
  if (!ivB64 || !tagB64 || !encB64) throw new Error("Invalid ciphertext format")
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const enc = Buffer.from(encB64, "base64")
  const key = keyBuffer()
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final("utf8")
}
