import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"

const ENVELOPE_VERSION = "v1"
const IV_BYTES = 12
const TAG_BYTES = 16

type EnvReader = (name: string) => string | undefined

function encryptionKey(getEnv: EnvReader): Buffer {
  const configured = getEnv("MARKET_RESEARCH_CREDENTIAL_ENCRYPTION_KEY")?.trim()
  if (configured) {
    const decoded = Buffer.from(configured, "base64")
    if (decoded.length !== 32) throw new Error("MARKET_RESEARCH_CREDENTIAL_ENCRYPTION_KEY 32 byte base64 olmalıdır.")
    return decoded
  }
  if (getEnv("NODE_ENV") === "production") {
    throw new Error("MARKET_RESEARCH_CREDENTIAL_ENCRYPTION_KEY production ortamında zorunludur.")
  }
  const localSecret = getEnv("SESSION_SECRET")?.trim()
  if (!localSecret) throw new Error("Yerel BYOK şifrelemesi için SESSION_SECRET gereklidir.")
  return createHash("sha256").update(`market-research-byok:${localSecret}`, "utf8").digest()
}

export function validateAnthropicApiKey(value: unknown): string {
  if (typeof value !== "string") throw new Error("Geçerli bir Anthropic API anahtarı girin.")
  const key = value.trim()
  if (key.length < 20 || key.length > 300 || /\s/.test(key)) {
    throw new Error("Geçerli bir Anthropic API anahtarı girin.")
  }
  return key
}

export function encryptMarketResearchApiKey(apiKey: string, getEnv: EnvReader = (name) => process.env[name]): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(getEnv), iv)
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [ENVELOPE_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

export function decryptMarketResearchApiKey(envelope: string, getEnv: EnvReader = (name) => process.env[name]): string {
  const [version, ivText, tagText, ciphertextText, extra] = envelope.split(".")
  if (version !== ENVELOPE_VERSION || !ivText || !tagText || !ciphertextText || extra) {
    throw new Error("Desteklenmeyen piyasa araştırması anahtar zarfı.")
  }
  const iv = Buffer.from(ivText, "base64url")
  const tag = Buffer.from(tagText, "base64url")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error("Geçersiz piyasa araştırması anahtar zarfı.")
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(getEnv), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8")
}

export async function getWorkshopMarketResearchCredential(workshopId: string) {
  const row = await prisma.marketResearchCredential.findUnique({
    where: { workshopId },
    select: { encryptedApiKey: true, maskedLast4: true, updatedAt: true },
  })
  return row ? { apiKey: decryptMarketResearchApiKey(row.encryptedApiKey), maskedLast4: row.maskedLast4, updatedAt: row.updatedAt } : null
}
