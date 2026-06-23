import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { computeTrialEnd, TRIAL_DAYS } from "../src/lib/plan"

/**
 * Manual workshop administration (early-access, before self-serve billing).
 *
 * Usage (run from project root):
 *   bunx tsx scripts/workshop-admin.ts list
 *   bunx tsx scripts/workshop-admin.ts approve <workshopId|ownerEmail>
 *   bunx tsx scripts/workshop-admin.ts reject  <workshopId|ownerEmail>
 *   bunx tsx scripts/workshop-admin.ts set-plan <workshopId|ownerEmail> <starter|pro|premium> [active|trialing|past_due|canceled]
 *
 * `approve` flips the workshop to approved AND starts the 15-day trial.
 */

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const TIERS = ["starter", "pro", "premium"] as const
const STATUSES = ["trialing", "active", "past_due", "canceled"] as const
type Tier = (typeof TIERS)[number]
type Status = (typeof STATUSES)[number]

/** Resolve a workshop by its id or by an owner's e-mail. */
async function resolveWorkshopId(idOrEmail: string): Promise<string | null> {
  const byId = await prisma.workshop.findUnique({ where: { id: idOrEmail }, select: { id: true } })
  if (byId) return byId.id
  const user = await prisma.user.findUnique({
    where: { email: idOrEmail.toLowerCase() },
    select: { workshopId: true },
  })
  return user?.workshopId ?? null
}

async function list() {
  const workshops = await prisma.workshop.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      approvalStatus: true,
      subscriptionStatus: true,
      planTier: true,
      trialEndsAt: true,
      requestedPlanTier: true,
      extraSeats: true,
      createdAt: true,
      users: { select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  })
  if (workshops.length === 0) {
    console.log("Hiç iş yeri yok.")
    return
  }
  for (const w of workshops) {
    const owner = w.users[0]?.email ?? "—"
    const trial = w.trialEndsAt ? w.trialEndsAt.toISOString().slice(0, 10) : "—"
    const req = w.requestedPlanTier ? `  ⬆ TALEP:${w.requestedPlanTier}` : ""
    const seats = w.extraSeats > 0 ? `  +${w.extraSeats}koltuk` : ""
    console.log(
      `${w.id}  ${w.approvalStatus.padEnd(8)} ${w.subscriptionStatus.padEnd(9)} ${w.planTier.padEnd(8)} trial→${trial}${seats}  ${owner}  | ${w.name}${req}`
    )
  }
}

async function approve(idOrEmail: string) {
  const id = await resolveWorkshopId(idOrEmail)
  if (!id) return fail(`İş yeri bulunamadı: ${idOrEmail}`)
  const now = new Date()
  await prisma.workshop.update({
    where: { id },
    data: {
      approvalStatus: "approved",
      subscriptionStatus: "trialing",
      trialStartedAt: now,
      trialEndsAt: computeTrialEnd(now),
    },
  })
  console.log(`✅ Onaylandı: ${id} — ${TRIAL_DAYS} günlük deneme başladı (bitiş: ${computeTrialEnd(now).toISOString().slice(0, 10)}).`)
}

async function reject(idOrEmail: string) {
  const id = await resolveWorkshopId(idOrEmail)
  if (!id) return fail(`İş yeri bulunamadı: ${idOrEmail}`)
  await prisma.workshop.update({ where: { id }, data: { approvalStatus: "rejected" } })
  console.log(`🚫 Reddedildi: ${id}`)
}

async function setPlan(idOrEmail: string, tier: string, status: string) {
  if (!TIERS.includes(tier as Tier)) return fail(`Geçersiz paket: ${tier} (${TIERS.join(", ")})`)
  if (!STATUSES.includes(status as Status)) return fail(`Geçersiz durum: ${status} (${STATUSES.join(", ")})`)
  const id = await resolveWorkshopId(idOrEmail)
  if (!id) return fail(`İş yeri bulunamadı: ${idOrEmail}`)
  await prisma.workshop.update({
    where: { id },
    data: {
      planTier: tier as Tier,
      subscriptionStatus: status as Status,
      approvalStatus: "approved",
      // Activation fulfils any pending upgrade request.
      requestedPlanTier: null,
      planRequestedAt: null,
    },
  })
  console.log(`✅ Plan güncellendi: ${id} → ${tier} / ${status}`)
}

async function setSeats(idOrEmail: string, nStr: string) {
  const n = Number.parseInt(nStr, 10)
  if (Number.isNaN(n) || n < 0) return fail(`Geçersiz koltuk sayısı: ${nStr}`)
  const id = await resolveWorkshopId(idOrEmail)
  if (!id) return fail(`İş yeri bulunamadı: ${idOrEmail}`)
  await prisma.workshop.update({ where: { id }, data: { extraSeats: n } })
  console.log(`✅ Ek koltuk güncellendi: ${id} → +${n} ek koltuk`)
}

function fail(msg: string) {
  console.error(`❌ ${msg}`)
  process.exitCode = 1
}

async function main() {
  const [cmd, arg, tier, status] = process.argv.slice(2)
  switch (cmd) {
    case "list":
      await list()
      break
    case "approve":
      if (!arg) return fail("Kullanım: approve <workshopId|ownerEmail>")
      await approve(arg)
      break
    case "reject":
      if (!arg) return fail("Kullanım: reject <workshopId|ownerEmail>")
      await reject(arg)
      break
    case "set-plan":
      if (!arg || !tier) return fail("Kullanım: set-plan <workshopId|ownerEmail> <tier> [status]")
      await setPlan(arg, tier, status || "active")
      break
    case "set-seats":
      if (!arg || tier === undefined) return fail("Kullanım: set-seats <workshopId|ownerEmail> <ek_koltuk_sayısı>")
      await setSeats(arg, tier)
      break
    default:
      console.log(
        [
          "BakimX workshop-admin",
          "  list",
          "  approve   <workshopId|ownerEmail>",
          "  reject    <workshopId|ownerEmail>",
          "  set-plan  <workshopId|ownerEmail> <starter|pro|premium> [active|trialing|past_due|canceled]",
          "  set-seats <workshopId|ownerEmail> <ek_koltuk_sayısı>",
        ].join("\n")
      )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
