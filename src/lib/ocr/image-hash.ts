import { createHash } from "crypto"

/**
 * Ham görsel byte'larının SHA-256'sı (lowercase hex).
 * Byte-hash dedup cache anahtarı: aynı upload → aynı hash.
 * Normalize ÖNCESİ ham buffer üzerinde çağrılır, normalize parametrelerinden bağımsızdır.
 */
export function hashImageBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}
