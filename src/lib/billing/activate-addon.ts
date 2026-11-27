import { Prisma, type BillingOrder } from "@prisma/client"
import { AuditLogAction } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { addonFeaturesFor, parseAddonOrderLines } from "@/lib/billing/addon-pricing"
import { resolveBillingAccount } from "@/lib/billing/account"
import { getSeatLimit, normalizeAddons } from "@/lib/plan"
import type { ActivateBillingOrderOpts } from "@/lib/billing/activate"

type Result =
  | { ok: true; seatAdjustment: { limit: number; deactivatedUsers: number; deactivatedTechnicians: number; revokedInvites: number } }
  | { ok: false; error: string }

/**
 * Ek özellik siparişini etkinleştirir (#829). Paket aktivasyonuyla aynı
 * talep (claim) korumasını kullanır: hesap atölyesi satırı kilitlenir,
 * `pending_payment → confirmed` geçişi tek seferliktir. Paketi, dönem sonunu
 * ve koltukları DEĞİŞTİRMEZ; yalnız hesabın tüm atölyelerinin `addons`'una
 * yazar ve hesap atölyesinde satın alınan anahtarları `paidAddons`'ta tutar.
 */
export async function activateAddonOrder(
  order: BillingOrder,
  opts: ActivateBillingOrderOpts,
): Promise<Result> {
  const lines = parseAddonOrderLines(order.addonLines)
  if (lines.length === 0) return { ok: false, error: "Sipariş kalemleri okunamadı." }
  const keys = lines.map((l) => l.key)
  const now = new Date()
  let periodEnd: Date
  let seatLimit = 0

  try {
    periodEnd = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${order.workshopId} FOR UPDATE`
      const account = await tx.workshop.findUnique({
        where: { id: order.workshopId },
        select: { id: true, organizationId: true, currentPeriodEnd: true, paidAddons: true, planTier: true, extraSeats: true },
      })
      if (!account) throw new Error("WORKSHOP_MISSING")
      seatLimit = getSeatLimit(account.planTier, account.extraSeats)
      const end = account.currentPeriodEnd
      if (!end || end.getTime() <= now.getTime()) throw new Error("PERIOD_ENDED")

      const claimed = await tx.billingOrder.updateMany({
        where: { id: order.id, status: "pending_payment" },
        data: {
          status: "confirmed",
          confirmedAt: now,
          confirmedByEmail: opts.confirmedByEmail,
          periodStart: now,
          periodEnd: end,
        },
      })
      if (claimed.count === 0) throw new Error("ALREADY_PROCESSED")

      const { workshopIds } = await resolveBillingAccount(account, tx)
      // Şube satırları da kilitlenir (sıralı id): eşzamanlı yazımlar okunan `addons`
      // üzerinden birbirini ezmesin. Hesap satırı zaten yukarıda kilitli; sıra
      // sabit olduğundan kilit sırası çakışmaz.
      const lockIds = [...new Set(workshopIds)].sort()
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id IN (${Prisma.join(lockIds)}) ORDER BY id FOR UPDATE`
      const targets = await tx.workshop.findMany({
        where: { id: { in: workshopIds } },
        select: { id: true, addons: true },
      })
      const granted = addonFeaturesFor(keys)
      for (const w of targets) {
        await tx.workshop.update({
          where: { id: w.id },
          data: { addons: normalizeAddons([...w.addons, ...granted]) },
        })
      }
      await tx.workshop.update({
        where: { id: account.id },
        data: { paidAddons: [...new Set([...account.paidAddons, ...keys])] },
      })
      return end
    })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "ALREADY_PROCESSED") return { ok: false, error: "Bu sipariş zaten işlenmiş." }
      if (err.message === "PERIOD_ENDED") {
        return { ok: false, error: "Paket döneminiz sona ermiş; ek özellik etkinleştirilemez." }
      }
    }
    console.error("[activateAddonOrder] failed:", err instanceof Error ? err.message : err)
    return { ok: false, error: "İşlem başarısız. Lütfen tekrar deneyin." }
  }

  await AuditLogAction(
    order.workshopId,
    opts.actorUserId ?? undefined,
    "BillingOrder",
    order.id,
    "billing_addon_order_confirmed",
    JSON.stringify({
      keys,
      cycle: order.billingCycle,
      amountMinor: order.amountMinor,
      periodEnd: periodEnd.toISOString(),
      actor: opts.actor,
    }),
  )
  return { ok: true, seatAdjustment: { limit: seatLimit, deactivatedUsers: 0, deactivatedTechnicians: 0, revokedInvites: 0 } }
}
