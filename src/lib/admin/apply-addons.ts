import { Prisma } from "@prisma/client"
import { pickAccountWorkshopId } from "../billing/account-pick"
import { normalizeAddons } from "../plan"
import { planAddonFanOut, resolveAddonTargets, type AddonFanOutPlan, type AddonTargetClient } from "./addon-targets"
import { planPaidAddonsAfterAdminChange, type PaidAddonsClient } from "./paid-addons-sync"

export type ApplyAdminAddonsResult =
  | { status: "not_found" }
  | { status: "noop"; plan: AddonFanOutPlan }
  | { status: "ok"; plan: AddonFanOutPlan; paidAddonsRemoved: string[] | null; accountId: string }

/**
 * Admin ek özellik yazımı (#827/#829/#1049) — interaktif transaction İÇİNDE çağrılır.
 * Kilit sırası aktivasyonla (`activate.ts`, `applyAddonEntitlementsTx`) aynıdır:
 * önce hesap atölyesi satırı, sonra organizasyonun kalan müşteri satırları sıralı
 * id ile. Hedefler ve `paidAddons` kilitten SONRA okunur; böylece eşzamanlı bir
 * yenileme/aktivasyon yazımı ezilmez, ölü okuma üzerinden yazılmaz.
 */
export async function applyAdminAddonsTx(
  tx: Prisma.TransactionClient,
  input: { workshopId: string; next: readonly string[]; actorUserId: string | null; source?: string },
): Promise<ApplyAdminAddonsResult> {
  const self = await tx.workshop.findFirst({
    where: { id: input.workshopId, kind: "customer" },
    select: { id: true, organizationId: true },
  })
  if (!self) return { status: "not_found" }
  const rows = self.organizationId
    ? await tx.workshop.findMany({
        where: { organizationId: self.organizationId, kind: "customer" },
        select: { id: true, createdAt: true },
      })
    : []
  const pool = rows.length > 0 ? rows : [{ id: self.id, createdAt: new Date(0) }]
  const accountId = pickAccountWorkshopId(pool)
  await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${accountId} FOR UPDATE`
  const others = [...new Set(pool.map((r) => r.id))].filter((id) => id !== accountId).sort()
  if (others.length > 0) {
    await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id IN (${Prisma.join(others)}) ORDER BY id FOR UPDATE`
  }

  const targets = await resolveAddonTargets(tx as unknown as AddonTargetClient, input.workshopId)
  if (!targets) return { status: "not_found" }
  const next = normalizeAddons(input.next)
  const plan = planAddonFanOut(targets, next)
  if (plan.noop) return { status: "noop", plan }

  // Satın alınmış anahtarın özelliği kapatılırsa sonraki yenilemede tahsil edilmez (#1049).
  const paid = await planPaidAddonsAfterAdminChange(tx as unknown as PaidAddonsClient, input.workshopId, next)
  await tx.workshop.updateMany({ where: { id: { in: plan.workshopIds }, kind: "customer" }, data: { addons: next } })
  if (paid) await tx.workshop.update({ where: { id: paid.accountId }, data: { paidAddons: paid.paidAddons } })
  // `AuditLogAction` tek satır yazar; yazım + şube başına kayıt atomik olmalı,
  // bu yüzden aynı şemayla doğrudan `auditLog.create` kullanılır.
  for (const { id, diff } of plan.entries) {
    await tx.auditLog.create({
      data: {
        workshopId: id,
        actorUserId: input.actorUserId,
        entityType: "Workshop",
        entityId: id,
        action: "admin_addons_set",
        metadataJson: JSON.stringify({
          ...diff,
          ...(plan.workshopIds.length > 1 ? { workshopIds: plan.workshopIds } : {}),
          ...(paid && id === paid.accountId ? { paidAddonsRemoved: paid.removed } : {}),
          ...(input.source ? { source: input.source } : {}),
        }),
      },
    })
  }
  return { status: "ok", plan, paidAddonsRemoved: paid?.removed ?? null, accountId }
}
