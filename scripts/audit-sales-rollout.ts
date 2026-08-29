import { existsSync } from "node:fs"
import path from "node:path"
import {
  buildSalesRolloutAuditReport,
  SALES_ROLLOUT_AUDIT_CATEGORIES,
  type SalesRolloutAuditSnapshot,
} from "../src/lib/sales/rollout-audit"

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), envFile)
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") process.loadEnvFile(envPath)
}

const args = new Set(process.argv.slice(2))
const json = args.has("--json")
const failOnFindings = args.has("--fail-on-findings")

if (args.has("--help")) {
  console.log(`Kullanım: bun run sales:rollout-audit -- [--json] [--fail-on-findings]\n\n` +
    "Salt okunur satış rollout denetimi. Varsayılan olarak bulgu olsa da exit 0 döner; " +
    "--fail-on-findings error/warning bulgularında exit 2 döndürür.")
  process.exit(0)
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil. Denetim başlatılmadı.")
  process.exit(1)
}

async function main(): Promise<void> {
  const { prisma } = await import("../src/lib/db")

  try {
    const [advisors, leads, billingOrders, commissions] = await Promise.all([
      prisma.salesAdvisor.findMany({
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              role: true,
              workshopId: true,
              workshop: { select: { kind: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      }),
      prisma.salesLead.findMany({
        select: {
          id: true,
          status: true,
          advisorId: true,
          workshopId: true,
          workshop: { select: { acquisitionSource: true, acquisitionAdvisorId: true } },
          registrationLinks: {
            where: { usedAt: { not: null } },
            select: { id: true, advisorId: true, workshopId: true },
            orderBy: { usedAt: "asc" },
          },
        },
        orderBy: { id: "asc" },
      }),
      prisma.billingOrder.findMany({
        select: {
          id: true,
          amountMinor: true,
          vatRateBps: true,
          grossAmountMinor: true,
          netAmountMinor: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.salesCommission.findMany({
        select: {
          id: true,
          reviewReason: true,
          ruleId: true,
          calculationBaseMinor: true,
          calculationRateBps: true,
          calculatedAmountMinor: true,
        },
        orderBy: { id: "asc" },
      }),
    ])

    const snapshot: SalesRolloutAuditSnapshot = {
      advisors: advisors.map((advisor) => ({
        id: advisor.id,
        userId: advisor.userId,
        userRole: advisor.user.role,
        workshopId: advisor.user.workshopId,
        workshopKind: advisor.user.workshop.kind,
      })),
      leads: leads.map((lead) => ({
        id: lead.id,
        status: lead.status,
        advisorId: lead.advisorId,
        workshopId: lead.workshopId,
        workshop: lead.workshop,
        usedRegistrationLinks: lead.registrationLinks,
      })),
      billingOrders,
      commissions,
    }
    const report = buildSalesRolloutAuditReport(snapshot)

    if (json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log("Satış rollout denetimi (salt okunur)")
      console.log(`Oluşturulma: ${report.generatedAt}`)
      console.log(
        `Taranan: ${report.scanned.advisors} danışman, ${report.scanned.leads} lead, ` +
        `${report.scanned.billingOrders} sipariş, ${report.scanned.commissions} hakediş`,
      )
      console.log(`Bulgular: ${report.totals.error} hata, ${report.totals.warning} uyarı, ${report.totals.info} bilgi`)

      for (const category of SALES_ROLLOUT_AUDIT_CATEGORIES) {
        const categoryFindings = report.findings.filter((finding) => finding.category === category)
        if (categoryFindings.length === 0) continue
        console.log(`\n[${category}] ${categoryFindings.length}`)
        for (const finding of categoryFindings) {
          const related = finding.relatedIds.length > 0 ? ` | ilişkili=${finding.relatedIds.join(",")}` : ""
          console.log(`- ${finding.severity.toUpperCase()} ${finding.entity}:${finding.id}${related}`)
          console.log(`  ${finding.detail}`)
        }
      }

      if (report.findings.length === 0) console.log("\nBulgu yok.")
    }

    if (failOnFindings && report.totals.error + report.totals.warning > 0) process.exitCode = 2
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((error: unknown) => {
  console.error("Satış rollout denetimi çalıştırılamadı.", error)
  process.exitCode = 1
})
