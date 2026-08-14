import { existsSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { normalizeArticleDetail } from "../src/lib/tecdoc/normalize"
import { buildArticleOemRows } from "../src/lib/tecdoc/oems"

// Prisma 7 + tsx don't auto-load .env files (mirrors prisma.config.ts / seed.ts).
// Load .env.local then .env before reading DATABASE_URL; never overrides real env.
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

/**
 * `tecdoc_cache`'teki ham `article-detail` cevaplarındaki OEM numaralarını
 * `tecdoc_article_oems` tablosuna yazar — SIFIR RapidAPI çağrısı (kota harcamaz).
 *
 * Neden gerekli: OEM araması (#312) bu tablodan okur, tablo ise detay ucundan
 * SONRA geldi. Uygulama her detay açılışında satırları kendisi yazar (bkz.
 * catalog.getArticleDetail) ama daha önce açılmış — yani zaten faturalanmış ve
 * cache'lenmiş — parçalar tekrar açılana kadar aranamaz kalırdı.
 *
 * Usage (run from project root, against the target DB):
 *   bunx tsx scripts/backfill-tecdoc-article-oems.ts           # rapor + yazar
 *   bunx tsx scripts/backfill-tecdoc-article-oems.ts --dry-run # sadece rapor
 *
 * Idempotent: `skipDuplicates` ile yazar, tekrar tekrar çalıştırılabilir.
 */

const DRY_RUN = process.argv.includes("--dry-run")
const CHUNK = 1000

// Uygulamanın kullandığı bağlantıyı kullanır (DIRECT_URL migration içindir ve
// yerelde AWS dev için gereken `sslmode=no-verify`'ı taşımayabilir).
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

/** `article-detail:<articleId>:<countryId>:<langId>` → articleId (bozuksa null). */
function parseDetailKey(key: string): number | null {
  const parts = key.split(":")
  if (parts.length !== 4 || parts[0] !== "article-detail") return null
  const articleId = Number(parts[1])
  return Number.isInteger(articleId) && articleId > 0 ? articleId : null
}

async function main() {
  const cached = await prisma.tecdocCache.findMany({
    where: { endpoint: "article-detail" },
    select: { key: true, rawResponse: true },
  })
  console.log(`ham 'article-detail' cache kaydı: ${cached.length}`)

  let failed = 0
  let noOem = 0
  let articles = 0
  let numbers = 0
  let written = 0
  let pending: ReturnType<typeof buildArticleOemRows> = []

  async function flush() {
    if (pending.length === 0) return
    const res = await prisma.tecdocArticleOem.createMany({ data: pending, skipDuplicates: true })
    written += res.count
    pending = []
  }

  for (const entry of cached) {
    const articleId = parseDetailKey(entry.key)
    if (articleId == null) {
      failed++
      console.warn(`  ! anahtar çözümlenemedi: ${entry.key}`)
      continue
    }

    let rows
    try {
      rows = buildArticleOemRows(articleId, normalizeArticleDetail(entry.rawResponse, articleId).oems)
    } catch (err) {
      failed++
      console.warn(`  ! normalize edilemedi: ${entry.key} — ${(err as Error).message}`)
      continue
    }
    if (rows.length === 0) {
      noOem++
      continue
    }

    articles++
    numbers += rows.length
    if (DRY_RUN) continue
    pending.push(...rows)
    if (pending.length >= CHUNK) await flush()
  }
  await flush()

  console.log(
    `\n${DRY_RUN ? `[dry-run] yazılacak: ${articles} parça / ${numbers} numara` : `yazıldı: ${articles} parça / ${written} yeni numara satırı (${numbers} okundu)`}` +
      ` · OEM'siz parça: ${noOem} · hatalı: ${failed}`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
