import { existsSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Prisma 7 + tsx don't auto-load .env files (mirrors prisma.config.ts / seed.ts).
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

/**
 * Merge duplicate customers so a phone belongs to a single customer per
 * workshop (pre-flight cleanup for the `@@unique([workshopId, phone])`
 * migration — see scripts/find-duplicate-phones.ts).
 *
 * For each colliding (workshopId, phone) group it keeps ONE survivor and folds
 * the rest into it: every related row (vehicles, intakes, quotes, appointments,
 * reminders, collections, OCR logs) is reassigned to the survivor, empty
 * survivor contact fields are backfilled from the merged records, and the
 * duplicates are deleted — all inside one transaction per group. All members of
 * a group share the same workshop + phone, so a merge never crosses tenants nor
 * creates a phone conflict.
 *
 * DEFAULT IS DRY-RUN. Nothing is written without --apply.
 *
 * Usage (run from project root, against the target DB):
 *   bunx tsx scripts/merge-duplicate-customers.ts                  # dry-run: plan for ALL groups
 *   bunx tsx scripts/merge-duplicate-customers.ts --apply          # merge ALL groups (auto survivor)
 *   bunx tsx scripts/merge-duplicate-customers.ts --keep <id> --merge <id>[,<id>...]          # dry-run, one group
 *   bunx tsx scripts/merge-duplicate-customers.ts --keep <id> --merge <id>[,<id>...] --apply  # merge one group
 *
 * Auto survivor = the record with the most related rows; ties broken by oldest
 * createdAt. Survivor's own non-empty fields always win; only NULL/empty fields
 * are backfilled. Conflicting non-empty scalar values are reported before delete
 * so nothing is silently lost.
 */

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// Related models keyed on customerId. All are reassigned to the survivor.
// The six with a required FK block a delete unless repointed; ocrLog is a soft
// link (nullable, no FK) but is repointed too for referential integrity.
const RELATION_COUNT_SELECT = {
  vehicles: true,
  intakes: true,
  quotes: true,
  appointments: true,
  reminders: true,
  collections: true,
} as const

// Contact/scalar fields backfilled onto the survivor when it's missing them.
// `phone` is intentionally excluded — group members already share it.
const BACKFILL_FIELDS = [
  "firstName", "lastName", "fullName", "companyName", "contactName",
  "phone2", "email", "city", "district", "address",
  "identityNumber", "taxNumber", "taxOffice", "notes",
] as const

type CustomerCore = {
  id: string
  workshopId: string
  phone: string
  type: string
  createdAt: Date
} & { [K in (typeof BACKFILL_FIELDS)[number]]: string | null }

function labelOf(c: Pick<CustomerCore, "type" | "firstName" | "lastName" | "fullName" | "companyName">): string {
  if (c.type === "corporate") return (c.companyName || "").trim() || "(isimsiz kurumsal)"
  const full = (c.fullName || "").trim()
  if (full) return full
  const name = [c.firstName || "", c.lastName || ""].map((s) => s.trim()).filter(Boolean).join(" ")
  return name || "(isimsiz)"
}

const CUSTOMER_SELECT = {
  id: true, workshopId: true, phone: true, type: true, createdAt: true,
  firstName: true, lastName: true, fullName: true, companyName: true, contactName: true,
  phone2: true, email: true, city: true, district: true, address: true,
  identityNumber: true, taxNumber: true, taxOffice: true, notes: true,
} as const

async function relationTotal(customerId: string): Promise<number> {
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { _count: { select: RELATION_COUNT_SELECT } },
  })
  if (!c) return 0
  return Object.values(c._count).reduce((a, b) => a + b, 0)
}

/** Reassign every related row to the survivor, backfill, delete dups, audit. Atomic. */
async function mergeGroup(survivor: CustomerCore, dups: CustomerCore[], apply: boolean) {
  const dupIds = dups.map((d) => d.id)
  const wsLabel = survivor.workshopId
  console.log(`\n— Atölye ${wsLabel} | Telefon ${survivor.phone}`)
  console.log(`   SAKLANAN: ${survivor.id}  ${labelOf(survivor)}`)
  for (const d of dups) console.log(`   BİRLEŞTİRİLEN → silinecek: ${d.id}  ${labelOf(d)}`)

  // Report scalar conflicts (both non-empty, different) — survivor wins.
  const backfill: Record<string, string> = {}
  for (const field of BACKFILL_FIELDS) {
    const survVal = (survivor[field] || "").trim()
    if (survVal) {
      for (const d of dups) {
        const dupVal = (d[field] || "").trim()
        if (dupVal && dupVal !== survVal) {
          console.log(`   ⚠ çakışan alan "${field}": saklanan="${survVal}" ≠ silinen="${dupVal}" (saklanan korunur)`)
        }
      }
      continue
    }
    // Survivor empty → take first non-empty from dups (oldest first).
    for (const d of dups) {
      const dupVal = (d[field] || "").trim()
      if (dupVal) { backfill[field] = dupVal; break }
    }
  }
  if (Object.keys(backfill).length) console.log(`   ↳ backfill: ${Object.keys(backfill).join(", ")}`)

  if (!apply) {
    console.log("   (dry-run — değişiklik yapılmadı; uygulamak için --apply)")
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const dupId of dupIds) {
      await tx.vehicle.updateMany({ where: { customerId: dupId }, data: { customerId: survivor.id } })
      await tx.vehicleIntakeForm.updateMany({ where: { customerId: dupId }, data: { customerId: survivor.id } })
      await tx.quote.updateMany({ where: { customerId: dupId }, data: { customerId: survivor.id } })
      await tx.appointment.updateMany({ where: { customerId: dupId }, data: { customerId: survivor.id } })
      await tx.maintenanceReminder.updateMany({ where: { customerId: dupId }, data: { customerId: survivor.id } })
      await tx.collectionPayment.updateMany({ where: { customerId: dupId }, data: { customerId: survivor.id } })
      await tx.ocrLog.updateMany({ where: { customerId: dupId }, data: { customerId: survivor.id } })
    }
    if (Object.keys(backfill).length) {
      await tx.customer.update({ where: { id: survivor.id }, data: backfill })
    }
    await tx.customer.deleteMany({ where: { id: { in: dupIds }, workshopId: survivor.workshopId } })
    await tx.auditLog.create({
      data: {
        workshopId: survivor.workshopId,
        actorUserId: undefined, // system/script actor
        entityType: "Customer",
        entityId: survivor.id,
        action: "customer_merged",
        metadataJson: JSON.stringify({ mergedIds: dupIds, phone: survivor.phone, backfilled: Object.keys(backfill) }),
      },
    })
  })
  console.log(`   ✓ birleştirildi (${dupIds.length} kayıt silindi)`)
}

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply")
  const keepIdx = argv.indexOf("--keep")
  const mergeIdx = argv.indexOf("--merge")
  const keep = keepIdx >= 0 ? argv[keepIdx + 1] : undefined
  const merge = mergeIdx >= 0 ? (argv[mergeIdx + 1] || "").split(",").map((s) => s.trim()).filter(Boolean) : undefined
  return { apply, keep, merge }
}

async function main() {
  const { apply, keep, merge } = parseArgs(process.argv.slice(2))

  // ---- Explicit single-group merge ------------------------------------------
  if (keep || merge) {
    if (!keep || !merge || merge.length === 0) {
      console.error("Kullanım: --keep <id> --merge <id>[,<id>...] [--apply]")
      return 2
    }
    const ids = [keep, ...merge]
    const rows = (await prisma.customer.findMany({ where: { id: { in: ids } }, select: CUSTOMER_SELECT })) as CustomerCore[]
    const byId = new Map(rows.map((r) => [r.id, r]))
    const survivor = byId.get(keep)
    if (!survivor) { console.error(`--keep ${keep} bulunamadı`); return 2 }
    const dups = merge.map((id) => byId.get(id)).filter(Boolean) as CustomerCore[]
    if (dups.length !== merge.length) { console.error("Bazı --merge id'leri bulunamadı"); return 2 }
    const badWs = dups.find((d) => d.workshopId !== survivor.workshopId)
    if (badWs) { console.error(`GÜVENLİK: ${badWs.id} farklı atölyede — atölyeler arası birleştirme yapılmaz`); return 2 }
    const badPhone = dups.find((d) => d.phone !== survivor.phone)
    if (badPhone) { console.error(`GÜVENLİK: ${badPhone.id} farklı telefonda (${badPhone.phone}) — yalnız aynı telefon birleştirilir`); return 2 }
    await mergeGroup(survivor, dups, apply)
    return 0
  }

  // ---- Auto: every duplicate group ------------------------------------------
  const groups = await prisma.customer.groupBy({
    by: ["workshopId", "phone"],
    _count: { _all: true },
    having: { phone: { _count: { gt: 1 } } },
  })
  if (groups.length === 0) {
    console.log("✓ Mükerrer telefon yok — birleştirilecek bir şey yok.")
    return 0
  }

  console.log(`${groups.length} mükerrer grup${apply ? " birleştiriliyor" : " (dry-run — plan)"}...`)
  for (const g of groups) {
    const members = (await prisma.customer.findMany({
      where: { workshopId: g.workshopId, phone: g.phone },
      select: CUSTOMER_SELECT,
      orderBy: { createdAt: "asc" },
    })) as CustomerCore[]

    // Survivor = most related rows; tie → oldest (members are createdAt asc).
    const totals = new Map<string, number>()
    for (const m of members) totals.set(m.id, await relationTotal(m.id))
    let survivor = members[0]
    for (const m of members) {
      if ((totals.get(m.id) || 0) > (totals.get(survivor.id) || 0)) survivor = m
    }
    const dups = members.filter((m) => m.id !== survivor.id)
    await mergeGroup(survivor, dups, apply)
  }

  if (!apply) console.log("\nUygulamak için aynı komutu --apply ile çalıştır. Sonra find-duplicate-phones.ts'i tekrar çalıştırıp 0 doğrula.")
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => pool.end())
