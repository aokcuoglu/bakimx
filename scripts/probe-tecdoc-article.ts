import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { buildPoolConfig } from "../src/lib/pg-connection"

// Prisma 7 + tsx don't auto-load .env files (mirrors prisma.config.ts / seed.ts).
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

/**
 * TecDoc parça DETAY uçlarını gerçek veriyle yoklar (probe) — şema/normalize
 * yazmadan ÖNCE çalıştırılır.
 *
 * Neden: RapidAPI koleksiyonunda kayıtlı örnek yanıt yok ve bu sağlayıcıda
 * uçlar güvenilmez (POST /articles/list-articles tüm alanları null döndürüyor —
 * bkz. src/lib/tecdoc/schemas.ts probe notları). Alan adlarını payload'ı
 * görmeden tahmin etmek yerine yokluyoruz.
 *
 * Örnek parçayı DB'den seçer (tecdoc_articles ∩ araç kataloğuna bağlı araç), her
 * ucu sırayla çağırır, ham yanıtları diske yazar ve kısa bir özet basar.
 *
 * Usage (proje kökünden, hedef DB'ye bağlıyken):
 *   bunx tsx scripts/probe-tecdoc-article.ts
 *   bunx tsx scripts/probe-tecdoc-article.ts --article-id 16483 --out /tmp/probe
 *
 * MALİYET: her uç 1 faturalı RapidAPI çağrısı (VIN ile ortak 18.000/ay kota).
 * Varsayılan koşuda ~8 çağrı. Sonuçlar cache'lenmez — bu script uygulamanın
 * cache katmanını (catalog.ts) bilerek atlar, ham payload'ı görmek içindir.
 */

const RAPIDAPI_HOST = "auto-parts-catalog.p.rapidapi.com"
const TYPE_ID = 1 // binek araç
const LANG_ID = 23 // Türkçe

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const OUT_DIR = argValue("--out") ?? path.join(__dirname, "..", ".probe-out")
const FORCED_ARTICLE_ID = Number(argValue("--article-id")) || null

const apiKey = process.env.RAPIDAPI_KEY
if (!apiKey) {
  console.error("RAPIDAPI_KEY yok (.env.local). Probe iptal.")
  process.exit(1)
}

const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL || process.env.DIRECT_URL || ""))
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

interface ProbeResult {
  name: string
  path: string
  status: number | "error"
  ms: number
  bytes: number
  shape: string
  error?: string
}

const results: ProbeResult[] = []

/** Yanıtın kaba şeklini insan-okur biçimde özetler (dizi mi, hangi anahtarlar). */
function describe(value: unknown, depth = 0): string {
  if (value === null) return "null"
  if (Array.isArray(value)) {
    if (value.length === 0) return "[] (boş)"
    return `Array(${value.length}) of ${describe(value[0], depth + 1)}`
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object)
    if (depth >= 1) return `{${keys.slice(0, 12).join(", ")}${keys.length > 12 ? ", …" : ""}}`
    return `{\n${keys
      .slice(0, 20)
      .map((k) => `    ${k}: ${describe((value as Record<string, unknown>)[k], depth + 1)}`)
      .join("\n")}\n  }`
  }
  return typeof value
}

async function probe(name: string, urlPath: string): Promise<unknown> {
  const started = Date.now()
  try {
    const res = await fetch(`https://${RAPIDAPI_HOST}${urlPath}`, {
      headers: {
        "x-rapidapi-key": apiKey!,
        "x-rapidapi-host": RAPIDAPI_HOST,
        accept: "application/json",
      },
    })
    const text = await res.text()
    const ms = Date.now() - started
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
    } catch {
      /* JSON değil — ham metin kaydedilir */
    }
    const file = path.join(OUT_DIR, `${name}.json`)
    writeFileSync(file, parsed ? JSON.stringify(parsed, null, 2) : text)
    results.push({
      name,
      path: urlPath,
      status: res.status,
      ms,
      bytes: text.length,
      shape: parsed ? describe(parsed) : "JSON DEĞİL",
    })
    return parsed
  } catch (err) {
    results.push({
      name,
      path: urlPath,
      status: "error",
      ms: Date.now() - started,
      bytes: 0,
      shape: "-",
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  // --- Örnek parça seç: kataloğa bağlı bir aracın cache'lenmiş parçalarından
  // supplier_id'si dolu olan biri (araca-özel kriter ucu supplierId istiyor).
  const vehicles = await prisma.vehicle.findMany({
    where: { catalogVehicleTypeId: { not: null } },
    select: { catalogVehicleTypeId: true, brand: true, model: true },
    take: 50,
  })
  const vehicleTypeIds = [...new Set(vehicles.map((v) => v.catalogVehicleTypeId!))]
  console.log(`kataloğa bağlı araç tipi: ${vehicleTypeIds.length} adet`)

  const sample = await prisma.tecdocArticle.findFirst({
    where: {
      supplierId: { not: null },
      ...(vehicleTypeIds.length > 0 ? { vehicleTypeId: { in: vehicleTypeIds } } : {}),
      ...(FORCED_ARTICLE_ID ? { tecdocArticleId: FORCED_ARTICLE_ID } : {}),
    },
    orderBy: { id: "asc" },
  })

  if (!sample) {
    console.error("Örnek parça bulunamadı (tecdoc_articles boş veya araç bağlı değil).")
    process.exit(1)
  }

  const articleId = sample.tecdocArticleId
  const vehicleId = sample.vehicleTypeId
  const categoryId = sample.categoryId
  const supplierId = sample.supplierId!
  const vehicleLabel = vehicles.find((v) => v.catalogVehicleTypeId === vehicleId)
  console.log(
    [
      "",
      "Örnek parça:",
      `  articleId   = ${articleId}`,
      `  articleNo   = ${sample.articleNo}`,
      `  ürün        = ${sample.productName}`,
      `  marka       = ${sample.supplierName} (supplierId=${supplierId})`,
      `  vehicleId   = ${vehicleId} (${vehicleLabel ? `${vehicleLabel.brand} ${vehicleLabel.model}` : "?"})`,
      `  categoryId  = ${categoryId}`,
      `  çıktı dizini= ${OUT_DIR}`,
      "",
    ].join("\n")
  )

  // --- Ülke filtresi: Türkiye'nin countryFilterId'si nedir? (koleksiyon 1 diyor)
  const countries = await probe("00-countries", `/countries/list-countries-by-lang-id/${LANG_ID}`)
  const trCandidates = JSON.stringify(countries ?? "")
    .split(",")
    .filter((s) => /turk|türk/i.test(s))
    .slice(0, 6)
  if (trCandidates.length > 0) console.log("Türkiye adayı kayıtlar:", trCandidates.join(" | "))

  const CF = Number(argValue("--country-filter-id")) || 1

  // --- Detay adayları
  await probe(
    "01-article-complete-details",
    `/articles/article-complete-details/type-id/${TYPE_ID}?articleId=${articleId}&countryFilterId=${CF}&langId=${LANG_ID}`
  )
  await probe("02-article-details", `/articles/details/article-id/${articleId}/lang-id/${LANG_ID}`)
  await probe(
    "03-article-specs",
    `/articles/selection-of-all-specifications-criterias-for-the-article/article-id/${articleId}/lang-id/${LANG_ID}/country-filter-id/${CF}`
  )
  await probe("04-article-media", `/articles/article-all-media-info?articleId=${articleId}&langId=${LANG_ID}`)
  await probe(
    "05-vehicle-criteria",
    `/articles/selection-of-the-criteria-for-articles-and-vehicle/type-id/${TYPE_ID}/product-id/${categoryId}/vehicle-id/${vehicleId}/supplier-id/${supplierId}/lang-id/${LANG_ID}/country-filter-id/${CF}`
  )
  await probe("06-cross-refs", `/artlookup/select-article-cross-references/article-id/${articleId}/lang-id/${LANG_ID}`)

  // --- Özet
  console.log("\n=== PROBE ÖZETİ ===")
  for (const r of results) {
    console.log(
      `\n▸ ${r.name}  [${r.status}]  ${r.ms}ms  ${r.bytes}B\n  ${r.path}\n  şekil: ${r.shape}${
        r.error ? `\n  HATA: ${r.error}` : ""
      }`
    )
  }
  console.log(`\nHam yanıtlar: ${OUT_DIR}`)
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
