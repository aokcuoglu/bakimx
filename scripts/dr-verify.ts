import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Pool } from "pg"
import { buildPoolConfig } from "../src/lib/pg-connection"

/**
 * Geri yüklenmiş bir veritabanının GERÇEKTEN kullanılabilir olduğunu doğrular.
 *
 * Neden var: "snapshot alınıyor" ile "yedekten dönebiliyoruz" aynı şey değil.
 * RDS'in `available` demesi yalnız instance'ın ayakta olduğunu söyler — şemanın
 * kodun beklediği migration seviyesinde olduğunu, verinin geldiğini ve
 * uygulamanın kullandığı sürücünün bağlanabildiğini söylemez. Tatbikatın
 * kanıt üreten adımı budur; `docs/operations/disaster-recovery.md` §4 bu
 * script'in çıktısını kayda geçirir.
 *
 * Salt-okunurdur: yalnız SELECT çalıştırır, hiçbir tabloya yazmaz.
 *
 * Kullanım (proje kökünden, tünel açıkken):
 *   DR_DB_URL_FILE=/tmp/.dr-db-url DB_SSL_NO_VERIFY=true bunx tsx scripts/dr-verify.ts
 *
 * `scripts/dr-drill.sh` bu adımı zaten kendisi çağırır; script'i elle çalıştırmak
 * yalnız tatbikat yarıda kaldığında gerekir.
 *
 * URL argv/env yerine DOSYADAN okunur (parola process listesine düşmesin) ve
 * host'un yerel tünel olması zorunludur: aksi halde script yanlışlıkla CANLI
 * veritabanına bağlanabilirdi.
 */

/** Boş olması tek başına arıza sayılmayan tablolar rapora girer ama kapı olmaz. */
const COUNT_TABLES = [
  "Workshop",
  "User",
  "Customer",
  "Vehicle",
  "VehicleIntakeForm",
  "VehiclePhoto",
  "ServiceOrder",
  "ServiceOrderItem",
  "AuditLog",
  "vehicle_type_details",
] as const

/** RPO kanıtı: en taze satırın zamanı ile snapshot zamanı arasındaki fark. */
const FRESHNESS_TABLES = ["Workshop", "Customer", "ServiceOrder", "AuditLog"] as const

/** Verinin gerçekten geldiğini gösteren minimum kapı — boş bir restore yeşil geçmesin. */
const MUST_BE_NONEMPTY = ["Workshop", "User", "vehicle_type_details"] as const

type Check = { ok: boolean; label: string; detail: string }

function localMigrations(): string[] {
  const dir = join(import.meta.dirname, "..", "prisma", "migrations")
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

async function main(): Promise<void> {
  const file = process.env.DR_DB_URL_FILE
  if (!file) throw new Error("DR_DB_URL_FILE gerekli (bkz. dosya başındaki kullanım notu)")

  const url = readFileSync(file, "utf8").trim()
  if (!/@localhost:\d+\//.test(url)) {
    throw new Error("İptal: bağlantı yerel SSM tünelinden (localhost:<port>) geçmeli")
  }

  const checks: Check[] = []
  const pool = new Pool({ ...buildPoolConfig(url), max: 1 })

  try {
    const started = Date.now()
    const meta = await pool.query<{ v: string; db: string; now: Date }>(
      "SELECT version() AS v, current_database() AS db, now() AS now",
    )
    checks.push({
      ok: true,
      label: "Bağlantı",
      detail: `${meta.rows[0].db} · ${meta.rows[0].v.split(" ").slice(0, 2).join(" ")} · ${Date.now() - started} ms`,
    })

    // ── Migration seviyesi ────────────────────────────────────────────────
    const applied = await pool.query<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>(
      `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name`,
    )
    const broken = applied.rows.filter((r) => !r.finished_at || r.rolled_back_at)
    checks.push({
      ok: broken.length === 0,
      label: "Yarım/geri alınmış migration",
      detail: broken.length === 0 ? "yok" : broken.map((r) => r.migration_name).join(", "),
    })

    // Kapı "DB, dal HEAD'iyle aynı seviyede mi" DEĞİL: prod snapshot'ı doğası
    // gereği `dev`'in gerisindedir (henüz release edilmemiş migration'lar). Arıza
    // olan iki şey var — kodun tanımadığı bir migration (yanlış/eski checkout ya
    // da elle müdahale) ve SIRA ORTASINDA eksik bir migration (bozuk geçmiş).
    // Sondaki eksikler yalnız "prod release'i geride" demektir; bilgi olarak yazılır.
    const local = localMigrations()
    const dbNames = new Set(applied.rows.map((r) => r.migration_name))
    const unknown = applied.rows.map((r) => r.migration_name).filter((m) => !local.includes(m))
    const missing = local.filter((m) => !dbNames.has(m))
    const tail = local.slice(local.length - missing.length)
    const gapsInMiddle = missing.filter((m) => !tail.includes(m))

    checks.push({
      ok: unknown.length === 0,
      label: "Kodun tanımadığı migration",
      detail: unknown.length === 0 ? "yok" : unknown.join(", "),
    })
    checks.push({
      ok: gapsInMiddle.length === 0,
      label: "Migration geçmişi kesintisiz",
      detail:
        gapsInMiddle.length === 0
          ? `${applied.rows.length} migration uygulanmış, son: ${applied.rows.at(-1)?.migration_name}`
          : `ARADA EKSİK (${gapsInMiddle.length}): ${gapsInMiddle.join(", ")}`,
    })
    if (missing.length > 0 && gapsInMiddle.length === 0) {
      console.log(
        `\nNot: bu daldaki son ${missing.length} migration snapshot'ta yok — kaynak ortam release'i geride demektir, arıza değil:\n  ${missing.join("\n  ")}`,
      )
    }

    // ── Satır sayıları ────────────────────────────────────────────────────
    const counts = new Map<string, number>()
    for (const table of COUNT_TABLES) {
      const r = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM "${table}"`)
      counts.set(table, Number(r.rows[0].n))
    }
    for (const table of MUST_BE_NONEMPTY) {
      checks.push({
        ok: (counts.get(table) ?? 0) > 0,
        label: `Veri geldi: ${table}`,
        detail: `${counts.get(table) ?? 0} satır`,
      })
    }

    // ── Tazelik (RPO kanıtı) ──────────────────────────────────────────────
    const freshness: string[] = []
    for (const table of FRESHNESS_TABLES) {
      const r = await pool.query<{ t: Date | null }>(`SELECT max("createdAt") AS t FROM "${table}"`)
      freshness.push(`${table}: ${r.rows[0].t ? r.rows[0].t.toISOString() : "—"}`)
    }

    console.log("\n── Satır sayıları ──")
    for (const [t, n] of counts) console.log(`  ${t.padEnd(24)} ${n}`)
    console.log("\n── En taze satır (RPO kanıtı) ──")
    for (const line of freshness) console.log(`  ${line}`)
  } finally {
    await pool.end()
  }

  console.log("\n── Kontroller ──")
  for (const c of checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.label.padEnd(38)} ${c.detail}`)

  const failed = checks.filter((c) => !c.ok)
  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} kontrol başarısız — geri yükleme KULLANILABİLİR DEĞİL.`)
    process.exitCode = 1
    return
  }
  console.log("\n✓ Geri yüklenen veritabanı kullanılabilir.")
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
