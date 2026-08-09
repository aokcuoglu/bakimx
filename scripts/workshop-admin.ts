import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { computeTrialEnd, TRIAL_DAYS } from "../src/lib/plan"
import { addPeriod } from "../src/lib/billing/period"
import { buildPoolConfig } from "../src/lib/pg-connection"

/**
 * Manual workshop administration (early-access, before self-serve billing).
 *
 * Usage (run from project root):
 *   bun run workshop list
 *   bun run workshop approve <workshopId|ownerEmail>
 *   bun run workshop reject  <workshopId|ownerEmail>
 *   bun run workshop set-plan <workshopId|ownerEmail> <starter|pro|premium> [status] [--cycle monthly|yearly] [--ends-in <gün>]
 *   bun run workshop set-seats <workshopId|ownerEmail> <ek_koltuk_sayısı>
 *
 * `approve` flips the workshop to approved AND starts the 15-day trial.
 */

// DATABASE_URL önce: `.env.local`'de sslmode'u taşıyan URL odur. DIRECT_URL'i
// tercih etmek AWS RDS'e SSM tüneli üzerinden bağlanırken P1010
// (`DatabaseAccessDenied`) veriyordu — RDS şifresiz TLS'i reddeder ve
// DIRECT_URL'de `sslmode=no-verify` yok. buildPoolConfig ayrıca DB_SSL_NO_VERIFY
// yolunu ve ölü tünelde sonsuza asılmayı önleyen bağlantı zaman aşımını getirir.
const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL || process.env.DIRECT_URL || ""))
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const TIERS = ["starter", "pro", "premium"] as const
const STATUSES = ["trialing", "active", "past_due", "canceled"] as const
const CYCLES = ["monthly", "yearly"] as const
type Tier = (typeof TIERS)[number]
type Status = (typeof STATUSES)[number]
type Cycle = (typeof CYCLES)[number]

const DAY_MS = 24 * 60 * 60 * 1000

export type PaidPeriodOptions = { cycle?: Cycle; endsInDays?: number }

/**
 * `set-plan`'in konumsal olmayan bayraklarını ayrıştırır.
 * Hata dizesi döner (null = sorun yok) ki çağıran tek yerde `fail()` etsin.
 */
export function parsePaidPeriodFlags(
  argv: string[]
): { options: PaidPeriodOptions; error: null } | { options: null; error: string } {
  const options: PaidPeriodOptions = {}
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === "--cycle") {
      if (!value || !CYCLES.includes(value as Cycle)) {
        return { options: null, error: `--cycle için geçersiz değer: ${value ?? "(boş)"} (${CYCLES.join(", ")})` }
      }
      options.cycle = value as Cycle
      i++
    } else if (flag === "--ends-in") {
      const n = Number(value)
      if (!value || !Number.isInteger(n)) {
        return { options: null, error: `--ends-in için geçersiz gün sayısı: ${value ?? "(boş)"}` }
      }
      options.endsInDays = n
      i++
    } else {
      return { options: null, error: `Bilinmeyen seçenek: ${flag}` }
    }
  }
  return { options, error: null }
}

/**
 * Ücretli dönemi çözer. `null` = bayrak verilmemiş, dönem alanlarına HİÇ
 * dokunulmaz (eski davranış korunur — bu script'i plan/durum değiştirmek için
 * kullanan mevcut alışkanlıklar bozulmasın).
 *
 * `--ends-in` bilerek negatif/0 günü de kabul eder: `subscription_expired`
 * kilidini ve abonelik bitiş uyarılarını (bkz. `src/lib/billing/lifecycle.ts`)
 * gerçek bir ödeme akışı kurmadan test etmenin tek yolu budur.
 */
export function resolvePaidPeriod(
  now: Date,
  options: PaidPeriodOptions
): { billingCycle: Cycle; currentPeriodEnd: Date } | null {
  const { cycle, endsInDays } = options
  if (cycle === undefined && endsInDays === undefined) return null
  return {
    // Yalnız --ends-in verildiğinde aylık varsayılır: dönem sonu zaten açıkça
    // belirtilmiştir, cycle burada sadece "hangi paketi yeniliyoruz" etiketidir.
    billingCycle: cycle ?? "monthly",
    currentPeriodEnd:
      endsInDays === undefined
        ? addPeriod(now, cycle as Cycle)
        : new Date(now.getTime() + endsInDays * DAY_MS),
  }
}

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
      currentPeriodEnd: true,
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
    // Ücretli dönem sonu erişim kapısının kendisi (getPlanState:
    // status=active && now > currentPeriodEnd → subscription_expired), o yüzden
    // listede görünmesi şart: geçmiş bir tarih ⛔ ile işaretlenir.
    const period = w.currentPeriodEnd
      ? `  abone→${w.currentPeriodEnd.toISOString().slice(0, 10)}${w.currentPeriodEnd.getTime() < Date.now() ? " ⛔" : ""}`
      : ""
    const req = w.requestedPlanTier ? `  ⬆ TALEP:${w.requestedPlanTier}` : ""
    const seats = w.extraSeats > 0 ? `  +${w.extraSeats}koltuk` : ""
    console.log(
      `${w.id}  ${w.approvalStatus.padEnd(8)} ${w.subscriptionStatus.padEnd(9)} ${w.planTier.padEnd(8)} trial→${trial}${period}${seats}  ${owner}  | ${w.name}${req}`
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

async function setPlan(idOrEmail: string, tier: string, status: string, options: PaidPeriodOptions) {
  if (!TIERS.includes(tier as Tier)) return fail(`Geçersiz paket: ${tier} (${TIERS.join(", ")})`)
  if (!STATUSES.includes(status as Status)) return fail(`Geçersiz durum: ${status} (${STATUSES.join(", ")})`)
  const period = resolvePaidPeriod(new Date(), options)
  // getPlanState currentPeriodEnd'e YALNIZ status=active iken bakar; başka bir
  // durumla dönem yazmak sessizce etkisiz kalır, o yüzden erken reddediyoruz.
  if (period && status !== "active") {
    return fail(`--cycle / --ends-in yalnız "active" durumuyla anlamlı (verilen: ${status}).`)
  }
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
      ...(period ?? {}),
    },
  })
  const periodNote = period
    ? ` — ${period.billingCycle}, dönem sonu ${period.currentPeriodEnd.toISOString().slice(0, 10)}`
    : ""
  console.log(`✅ Plan güncellendi: ${id} → ${tier} / ${status}${periodNote}`)
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
  const argv = process.argv.slice(2)
  // İlk `--` bayrağından itibarası bayrak bölgesi. Bayrakları tek tek
  // süzmek yerine bölmek şart: `--cycle yearly`'de "yearly" bir DEĞER, konumsal
  // argüman değil — süzülseydi status sanılıp "geçersiz durum" hatası verirdi.
  const flagStart = argv.findIndex((a) => a.startsWith("--"))
  const positional = flagStart === -1 ? argv : argv.slice(0, flagStart)
  const flags = flagStart === -1 ? [] : argv.slice(flagStart)
  const [cmd, arg, tier, status] = positional
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
    case "set-plan": {
      if (!arg || !tier)
        return fail(
          "Kullanım: set-plan <workshopId|ownerEmail> <tier> [status] [--cycle monthly|yearly] [--ends-in <gün>]"
        )
      const parsed = parsePaidPeriodFlags(flags)
      // `options === null` üzerinden daraltıyoruz: `error` string olduğu için
      // doğruluk kontrolü TS'te ayrımı yapmıyor (boş dize de string'dir).
      if (parsed.options === null) return fail(parsed.error)
      await setPlan(arg, tier, status || "active", parsed.options)
      break
    }
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
          "              [--cycle monthly|yearly]  ücretli dönemi de yaz (bitiş = şimdi + 1 ay/yıl)",
          "              [--ends-in <gün>]         dönem sonunu elle ayarla (0/negatif = süresi dolmuş)",
          "  set-seats <workshopId|ownerEmail> <ek_koltuk_sayısı>",
          "",
          "Örnek: bun run workshop set-plan usta@atolye.com premium active --cycle yearly",
          "Örnek: bun run workshop set-plan usta@atolye.com pro active --cycle monthly --ends-in 3",
        ].join("\n")
      )
  }
}

// Testler saf yardımcıları import edebilsin diye: yalnız doğrudan
// çalıştırıldığında koş (bkz. scripts/prod-reset.ts'teki aynı desen).
if (process.argv[1]?.endsWith("workshop-admin.ts")) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
