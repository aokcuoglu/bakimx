import { existsSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { normalizeArticles } from "../src/lib/tecdoc/normalize"

// Prisma 7 + tsx don't auto-load .env files (mirrors prisma.config.ts / seed.ts).
// Load .env.local then .env before reading DATABASE_URL; never overrides real env.
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

/**
 * `tecdoc_cache`'teki ham `articles` cevaplarını yeniden normalize edip
 * `tecdoc_articles` tablosuna yazar — SIFIR RapidAPI çağrısı (kota harcamaz).
 *
 * Neden gerekli: satır-başına upsert'lerden kurulu eski `$transaction([...])`
 * batch'i, dizi formunda `timeout` seçeneği olmadığı için 5 sn'lik varsayılan
 * sınıra takılıyor ve büyük kategorilerde (≈200+ parça, uzak DB gecikmesi) TÜM
 * batch geri alınıyordu (P2028). Ham JSON cache'lendiği için parçalar picker'da
 * görünüyor ama iş emri arama kutusu (DB'den okur) hiçbirini bulamıyordu.
 * catalog.ts `createMany`'ye geçti; bu script mevcut boşlukları kapatır.
 *
 * Usage (run from project root, against the target DB):
 *   bunx tsx scripts/backfill-tecdoc-articles.ts          # rapor + yazar
 *   bunx tsx scripts/backfill-tecdoc-articles.ts --dry-run # sadece rapor
 *
 * Idempotent: zaten satırı olan (araç, kategori) çiftleri atlanır.
 */

const DRY_RUN = process.argv.includes("--dry-run")
const CHUNK = 1000

// Uygulamanın kullandığı bağlantıyı kullanır (DIRECT_URL migration içindir ve
// yerelde AWS dev için gereken `sslmode=no-verify`'ı taşımayabilir).
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

/** `articles:<typeId>:<vehicleId>:<categoryId>:<langId>` → id'ler (bozuksa null). */
function parseArticlesKey(key: string): { vehicleId: number; categoryId: number } | null {
  const parts = key.split(":")
  if (parts.length !== 5 || parts[0] !== "articles") return null
  const vehicleId = Number(parts[2])
  const categoryId = Number(parts[3])
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) return null
  if (!Number.isInteger(categoryId) || categoryId <= 0) return null
  return { vehicleId, categoryId }
}

async function main() {
  const cached = await prisma.tecdocCache.findMany({
    where: { endpoint: "articles" },
    select: { key: true, rawResponse: true },
  })
  console.log(`ham 'articles' cache kaydı: ${cached.length}`)

  // Hangi (araç, kategori) çiftlerinde zaten satır var?
  const existing = new Set(
    (
      await prisma.tecdocArticle.findMany({
        distinct: ["vehicleTypeId", "categoryId"],
        select: { vehicleTypeId: true, categoryId: true },
      })
    ).map((r) => `${r.vehicleTypeId}:${r.categoryId}`)
  )

  let skipped = 0
  let empty = 0
  let failed = 0
  let categories = 0
  let rows = 0

  for (const entry of cached) {
    const parsed = parseArticlesKey(entry.key)
    if (!parsed) {
      failed++
      console.warn(`  ! anahtar çözümlenemedi: ${entry.key}`)
      continue
    }
    const { vehicleId, categoryId } = parsed
    if (existing.has(`${vehicleId}:${categoryId}`)) {
      skipped++
      continue
    }

    let articles
    try {
      articles = normalizeArticles(entry.rawResponse)
    } catch (err) {
      failed++
      console.warn(`  ! normalize edilemedi: ${entry.key} — ${(err as Error).message}`)
      continue
    }
    if (articles.length === 0) {
      empty++
      continue
    }

    console.log(`  ${DRY_RUN ? "[dry-run] " : ""}araç ${vehicleId} / kategori ${categoryId}: ${articles.length} parça`)
    categories++
    rows += articles.length
    if (DRY_RUN) continue

    // Aynı chunk'lama + dedupe mantığı catalog.ts persistArticles ile eştir
    // (script Prisma client'ı kendi kurduğu için fonksiyonu import etmiyoruz).
    const unique = [...new Map(articles.map((a) => [a.tecdocArticleId, a])).values()]
    for (let i = 0; i < unique.length; i += CHUNK) {
      await prisma.tecdocArticle.createMany({
        data: unique.slice(i, i + CHUNK).map((a) => ({
          vehicleTypeId: vehicleId,
          categoryId,
          tecdocArticleId: a.tecdocArticleId,
          articleNo: a.articleNo,
          productName: a.productName,
          supplierName: a.supplierName,
          supplierId: a.supplierId,
          imageUrl: a.imageUrl,
        })),
        skipDuplicates: true,
      })
    }
  }

  console.log(
    `\n${DRY_RUN ? "[dry-run] yazılacak" : "yazıldı"}: ${categories} kategori / ${rows} parça` +
      ` · atlandı (satır var): ${skipped} · boş kategori: ${empty} · hatalı: ${failed}`
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
