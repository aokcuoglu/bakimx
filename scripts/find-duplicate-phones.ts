import { existsSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Prisma 7 + tsx don't auto-load .env files (mirrors prisma.config.ts / seed.ts).
// Load .env.local then .env before reading DATABASE_URL; never overrides real env.
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

/**
 * Read-only duplicate-phone report (pre-flight for the `Customer` unique
 * constraint on [workshopId, phone]).
 *
 * A phone belongs to a single customer within a workshop. Before the
 * `@@unique([workshopId, phone])` migration can apply, every workshop must have
 * at most one customer per phone. This script lists the colliding groups with
 * enough context (record counts, dates) to decide which record to KEEP and
 * which to merge/retire.
 *
 * Usage (run from project root, against the target DB):
 *   bunx tsx scripts/find-duplicate-phones.ts
 *
 * Exit code: 0 = no duplicates (safe to migrate), 1 = duplicates found.
 * NEVER writes — resolve collisions manually (reassign the duplicate's
 * vehicles/intakes/quotes to the survivor, then delete it, or fix a mistyped
 * phone). Re-run until it reports 0.
 */

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

function labelOf(c: {
  type: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
}): string {
  if (c.type === "corporate") return (c.companyName || "").trim() || "(isimsiz kurumsal)"
  const full = (c.fullName || "").trim()
  if (full) return full
  const name = [c.firstName || "", c.lastName || ""].map((s) => s.trim()).filter(Boolean).join(" ")
  return name || "(isimsiz)"
}

async function main() {
  // Colliding (workshopId, phone) groups: more than one customer share a phone.
  const groups = await prisma.customer.groupBy({
    by: ["workshopId", "phone"],
    _count: { _all: true },
    having: { phone: { _count: { gt: 1 } } },
  })

  if (groups.length === 0) {
    console.log("✓ Mükerrer telefon yok — @@unique([workshopId, phone]) migration'ı güvenle uygulanabilir.")
    return 0
  }

  const workshopIds = [...new Set(groups.map((g) => g.workshopId))]
  const workshops = await prisma.workshop.findMany({
    where: { id: { in: workshopIds } },
    select: { id: true, name: true },
  })
  const workshopName = new Map(workshops.map((w) => [w.id, w.name]))

  const totalExtra = groups.reduce((sum, g) => sum + (g._count._all - 1), 0)
  console.log(
    `✗ ${groups.length} mükerrer (atölye, telefon) grubu bulundu; silinmesi/birleştirilmesi gereken ${totalExtra} fazla kayıt var.\n`,
  )

  for (const g of groups) {
    const members = await prisma.customer.findMany({
      where: { workshopId: g.workshopId, phone: g.phone },
      select: {
        id: true,
        type: true,
        firstName: true,
        lastName: true,
        fullName: true,
        companyName: true,
        createdAt: true,
        _count: {
          select: {
            vehicles: true,
            intakes: true,
            quotes: true,
            appointments: true,
            reminders: true,
            collections: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const wsLabel = workshopName.get(g.workshopId) || g.workshopId
    console.log(`— Atölye: ${wsLabel}  |  Telefon: ${g.phone}  (${members.length} kayıt)`)
    for (const m of members) {
      const c = m._count
      const links = `araç:${c.vehicles} kabul:${c.intakes} teklif:${c.quotes} randevu:${c.appointments} hatırlatma:${c.reminders} tahsilat:${c.collections}`
      const date = m.createdAt.toISOString().slice(0, 10)
      console.log(`    · ${m.id}  ${date}  ${labelOf(m).padEnd(24)}  [${links}]`)
    }
    console.log("")
  }

  console.log(
    "Çözüm: her grupta bağlı kaydı en çok olanı SAKLA; diğerlerinin araç/kabul/teklif/randevu/hatırlatma/tahsilat\n" +
      "ilişkilerini saklanan kayda taşıyıp fazlalıkları sil, ya da yanlış girilmiş telefonu düzelt. Temizlik bitince\n" +
      "bu script 0 dönene kadar tekrar çalıştır; sonra migration'ı uygula.",
  )
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e)
    process.exit(2)
  })
  .finally(() => pool.end())
