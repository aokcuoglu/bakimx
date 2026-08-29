import { createHash, randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import path from "node:path"
import { PrismaClient, type AdminRole } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { Pool } from "pg"
import { buildPoolConfig } from "../../src/lib/pg-connection"

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), envFile)
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") process.loadEnvFile(envPath)
}

const databaseUrl = process.env.DATABASE_URL ?? ""
const databaseHost = (() => {
  try {
    return new URL(databaseUrl).hostname
  } catch {
    return ""
  }
})()
const remoteAllowed = process.env.SALES_E2E_ALLOW_REMOTE_DB === "true"
if (!databaseUrl || process.env.NODE_ENV === "production") {
  throw new Error("Satış E2E fixture'ı production veya bağlantısız ortamda çalışmaz.")
}
if (!remoteAllowed && !["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
  throw new Error("Satış E2E fixture'ı yalnız yerel/tünellenmiş DB kullanır. İzole uzak CI DB için SALES_E2E_ALLOW_REMOTE_DB=true gerekir.")
}

const pool = new Pool(buildPoolConfig(databaseUrl))
export const salesE2EPrisma = new PrismaClient({ adapter: new PrismaPg(pool) })

export type SalesE2EFixture = {
  runKey: string
  prefix: string
  password: string
  founderEmail: string
  invitedAdvisorEmail: string
  customerOwnerEmail: string
  roleEmails: Record<AdminRole, string>
  advisorBEmail: string
  advisorBId: string
  advisorBLeadId: string
  revokedRegistrationToken: string
  expiredRegistrationToken: string
  commissionRuleId: string | null
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function rawToken(): string {
  return randomBytes(32).toString("base64url")
}

export async function setupSalesE2EFixture(): Promise<SalesE2EFixture> {
  const runKey = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`
  const prefix = `e2e-573-${runKey}`
  const password = "E2eSales!2026"
  const founderEmail = "admin@bakimx.com"
  const invitedAdvisorEmail = `${prefix}-advisor-a@example.com`
  const customerOwnerEmail = `${prefix}-owner@example.com`
  const advisorBEmail = `${prefix}-advisor-b@example.com`
  const roleEmails = {
    founder: founderEmail,
    support: `${prefix}-support@example.com`,
    finance: `${prefix}-finance@example.com`,
    readonly: `${prefix}-readonly@example.com`,
  } satisfies Record<AdminRole, string>

  const founder = await salesE2EPrisma.user.findUnique({
    where: { email: founderEmail },
    select: { id: true, workshopId: true, platformAdmin: { select: { role: true, disabledAt: true } } },
  })
  if (!founder?.platformAdmin || founder.platformAdmin.disabledAt || founder.platformAdmin.role !== "founder") {
    throw new Error("admin@bakimx.com etkin founder değil. Önce bun run db:seed çalıştırın.")
  }
  const internalWorkshop = await salesE2EPrisma.workshop.findFirst({
    where: { kind: "internal" },
    select: { id: true },
  })
  if (!internalWorkshop) throw new Error("BakımX İç Operasyon iş yeri bulunamadı; migration durumunu kontrol edin.")

  const passwordHash = await bcrypt.hash(password, 4)
  for (const role of ["support", "finance", "readonly"] as const) {
    const user = await salesE2EPrisma.user.create({
      data: {
        email: roleEmails[role],
        password: passwordHash,
        firstName: "E2E",
        lastName: role,
        workshopId: founder.workshopId,
        // Platform admin fixture'ları mevcut müşteri-owner kimlik modelini taklit
        // eder. `staff`, tenant middleware'inde bilinçli olarak /technician'a
        // kapalıdır; platform yetkisi ayrı PlatformAdmin satırından gelir.
        role: "owner",
      },
    })
    await salesE2EPrisma.platformAdmin.create({
      data: { userId: user.id, role, createdByUserId: founder.id },
    })
  }

  const advisorBUser = await salesE2EPrisma.user.create({
    data: {
      email: advisorBEmail,
      password: passwordHash,
      firstName: "E2E",
      lastName: "Danışman B",
      workshopId: internalWorkshop.id,
      role: "staff",
    },
  })
  const advisorB = await salesE2EPrisma.salesAdvisor.create({ data: { userId: advisorBUser.id } })
  const advisorBLead = await salesE2EPrisma.salesLead.create({
    data: {
      source: "field",
      businessName: `${prefix} çapraz erişim`,
      contactName: "Çapraz Erişim",
      phone: `05${runKey.replace(/\D/g, "").padEnd(9, "7").slice(0, 9)}`,
      normalizedPhone: `5${runKey.replace(/\D/g, "").padEnd(9, "7").slice(0, 9)}`,
      email: `${prefix}-cross@example.com`,
      normalizedEmail: `${prefix}-cross@example.com`,
      city: "İstanbul",
      advisorId: advisorB.id,
    },
  })
  const tokenLead = await salesE2EPrisma.salesLead.create({
    data: {
      source: "field",
      status: "onboarding",
      businessName: `${prefix} token durumları`,
      contactName: "Token Kontrol",
      phone: `05${runKey.replace(/\D/g, "").padEnd(9, "8").slice(0, 9)}`,
      normalizedPhone: `5${runKey.replace(/\D/g, "").padEnd(9, "8").slice(0, 9)}`,
      city: "Ankara",
      advisorId: advisorB.id,
    },
  })
  const revokedRegistrationToken = rawToken()
  const expiredRegistrationToken = rawToken()
  await salesE2EPrisma.salesRegistrationLink.createMany({
    data: [
      {
        leadId: tokenLead.id,
        advisorId: advisorB.id,
        tokenHash: tokenHash(revokedRegistrationToken),
        expiresAt: new Date(Date.now() + 60 * 60_000),
        revokedAt: new Date(),
        revokedById: advisorBUser.id,
        createdById: advisorBUser.id,
      },
      {
        leadId: tokenLead.id,
        advisorId: advisorB.id,
        tokenHash: tokenHash(expiredRegistrationToken),
        expiresAt: new Date(Date.now() - 60_000),
        createdById: advisorBUser.id,
      },
    ],
  })

  return {
    runKey,
    prefix,
    password,
    founderEmail,
    invitedAdvisorEmail,
    customerOwnerEmail,
    roleEmails,
    advisorBEmail,
    advisorBId: advisorB.id,
    advisorBLeadId: advisorBLead.id,
    revokedRegistrationToken,
    expiredRegistrationToken,
    commissionRuleId: null,
  }
}

export async function cleanupSalesE2EFixture(fixture: SalesE2EFixture | null): Promise<void> {
  if (!fixture) return
  await cleanupSalesE2EFixtureByPrefix(fixture.prefix, fixture.commissionRuleId)
}

export async function cleanupSalesE2EFixtureByPrefix(
  prefix: string,
  commissionRuleId: string | null = null,
): Promise<void> {
  if (!prefix.startsWith("e2e-573-")) {
    throw new Error("Satış E2E temizliği yalnız e2e-573- önekli kayıtları silebilir.")
  }
  const users = await salesE2EPrisma.user.findMany({
    where: { email: { startsWith: prefix } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)
  const createdWorkshops = await salesE2EPrisma.workshop.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true },
  })
  const workshopIds = createdWorkshops.map((workshop) => workshop.id)
  const leads = await salesE2EPrisma.salesLead.findMany({
    where: { businessName: { startsWith: prefix } },
    select: { id: true },
  })
  const leadIds = leads.map((lead) => lead.id)
  const commissions = await salesE2EPrisma.salesCommission.findMany({
    where: { leadId: { in: leadIds } },
    select: { id: true },
  })
  const commissionIds = commissions.map((commission) => commission.id)

  await salesE2EPrisma.$transaction(async (tx) => {
    await tx.salesCommissionEvent.deleteMany({ where: { commissionId: { in: commissionIds } } })
    await tx.salesCommission.deleteMany({ where: { id: { in: commissionIds } } })
    if (commissionRuleId) {
      await tx.salesCommissionRule.deleteMany({
        where: { id: commissionRuleId, commissions: { none: {} } },
      })
    }
    await tx.paymentTransaction.deleteMany({ where: { workshopId: { in: workshopIds } } })
    await tx.billingOrder.deleteMany({ where: { workshopId: { in: workshopIds } } })
    await tx.salesRegistrationLink.deleteMany({ where: { leadId: { in: leadIds } } })
    await tx.salesActivity.deleteMany({ where: { leadId: { in: leadIds } } })
    await tx.salesTask.deleteMany({ where: { leadId: { in: leadIds } } })
    await tx.salesLeadAssignment.deleteMany({ where: { leadId: { in: leadIds } } })
    await tx.salesDiscountCode.deleteMany({ where: { leadId: { in: leadIds } } })
    await tx.salesReferral.deleteMany({ where: { leadId: { in: leadIds } } })
    await tx.salesLead.deleteMany({ where: { id: { in: leadIds } } })
    await tx.salesAdvisorMonthlyTarget.deleteMany({ where: { advisor: { userId: { in: userIds } } } })
    await tx.salesDiscountCode.deleteMany({ where: { advisor: { userId: { in: userIds } } } })
    await tx.salesAdvisorInvite.deleteMany({ where: { email: { startsWith: prefix } } })
    await tx.communicationLog.deleteMany({
      where: { OR: [{ workshopId: { in: workshopIds } }, { recipient: { startsWith: prefix } }] },
    })
    await tx.auditLog.deleteMany({
      where: { OR: [{ workshopId: { in: workshopIds } }, { actorUserId: { in: userIds } }] },
    })
    await tx.platformAdmin.deleteMany({ where: { userId: { in: userIds } } })
    await tx.salesAdvisor.deleteMany({ where: { userId: { in: userIds } } })
    await tx.user.deleteMany({ where: { id: { in: userIds } } })
    await tx.technician.deleteMany({ where: { workshopId: { in: workshopIds } } })
    await tx.workshopSettings.deleteMany({ where: { workshopId: { in: workshopIds } } })
    await tx.workshop.deleteMany({ where: { id: { in: workshopIds } } })
  }, { timeout: 30_000 })
}

export async function disconnectSalesE2EFixture(): Promise<void> {
  await salesE2EPrisma.$disconnect()
  await pool.end()
}
