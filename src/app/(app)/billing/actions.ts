"use server"

import { assertLiteRegistrationOpen, LiteRegistrationClosedError, isLiteRegistrationOpen, LITE_REGISTRATION_CLOSED } from "@/lib/lite-campaign"
import { revalidatePath } from "next/cache"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { checkoutInAppSchema } from "@/lib/validations/billing"
import { getPlanPriceMinor, isComplimentaryPlan } from "@/lib/billing/pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import { computeUpgradeAmountMinor } from "@/lib/billing/proration"
import { getDiscountedPlanPriceMinor, getOrderReferralDiscountBps, getReferralDiscountBps } from "@/lib/billing/referral-discount"
import { deriveBillingOrderType } from "@/lib/billing/order-type"
import { DOWNGRADE_BLOCKED_MESSAGE, isDowngradeBlocked } from "@/lib/billing/plan-change"
import { createBillingTaxSnapshot } from "@/lib/billing/tax"
import type { BillingCycle } from "@prisma/client"
import type { PlanTier } from "@/lib/plan"
import { actorCan } from "@/lib/roles"
import { activateBillingOrder } from "@/lib/billing/activate"
import { canCancelPendingCardOrder } from "@/lib/billing/cancellation"

/**
 * Creates a pending-payment BillingOrder for the current workshop (upgrade /
 * renewal / first paid purchase). An admin later confirms the havale in /admin,
 * which activates the plan. workshopId is derived from the session — never the
 * client — to preserve tenant isolation.
 */
export async function createBillingOrder(input: {
  tier: string
  cycle: string
  method?: string
  invoiceTitle: string
  taxNumber: string
  taxOffice?: string
}): Promise<
  | { ok: true; reference: string; amountMinor: number; method: "card" | "havale"; complimentary: boolean }
  | { ok: false; error: string }
> {
  const { user, workshop } = await getCurrentUserWithWorkshop()
  // Rol kapısı EVET, plan yazma kilidi HAYIR: satın alma tam da planı bitmiş
  // atölyenin yapacağı iş; requireWritableWorkshop burada checkout'u kilitlerdi.
  if (!actorCan(user, "billing.manage")) {
    return { ok: false, error: "Bu işlem için yetkiniz yok." }
  }

  const parsed = checkoutInAppSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }
  const data = parsed.data
  const tier = data.tier as PlanTier
  const cycle = data.cycle as BillingCycle
  if (tier === "lite" && !workshop.liteFreeGrantedAt && !isLiteRegistrationOpen()) {
    return { ok: false, error: LITE_REGISTRATION_CLOSED }
  }

  // Tekrar mükerrer talebi engelle: aynı workshop'un zaten bekleyen bir siparişi
  // varsa (hesap üzerinden) VEYA aynı vergi/TC no ile başka bir workshop'un
  // bekleyen siparişi varsa (kimlik üzerinden) yeni talep oluşturulamaz.
  const duplicatePending = await prisma.billingOrder.findFirst({
    where: {
      status: "pending_payment",
      OR: [{ workshopId: workshop.id }, { workshop: { taxNumber: data.taxNumber } }],
    },
    select: { workshopId: true },
  })
  if (duplicatePending) {
    return {
      ok: false,
      error:
        duplicatePending.workshopId === workshop.id
          ? "Zaten bekleyen bir paket talebiniz var. Ödemeniz onaylanana kadar yeni bir talep oluşturamazsınız."
          : "Bu vergi/TC kimlik numarasına ait bekleyen bir paket talebi zaten var.",
    }
  }

  // Aktif / açık dönemde alt pakete geçiş yok — iade olmadığı için dönem
  // ortası düşürme ödenmiş hakları boşa harcar. Yenileme ve yükseltme serbest.
  if (
    isDowngradeBlocked({
      subscriptionStatus: workshop.subscriptionStatus,
      planTier: workshop.planTier,
      currentPeriodEnd: workshop.currentPeriodEnd,
      targetTier: tier,
    })
  ) {
    return { ok: false, error: DOWNGRADE_BLOCKED_MESSAGE }
  }

  // Sipariş tipini türet. Aktif + aynı paket talebi KASITLI olarak reddedilmez:
  // "renewal" olarak işlenir (dönem sonundan uzar, gün kaybı yok — bkz. activate.ts).
  // Aynı paket için mükerrer talep, yukarıdaki bekleyen-sipariş guard'ı ile
  // zaten engellenmiştir; bu yüzden burada ayrı bir "zaten sahipsiniz" reddi yok.
  const type = deriveBillingOrderType({
    subscriptionStatus: workshop.subscriptionStatus,
    planTier: workshop.planTier,
    currentPeriodEnd: workshop.currentPeriodEnd,
    targetTier: tier,
  })

  // Paket değişimleri mevcut davranışı koruyarak kullanılmayan dönem kredisini
  // uygular; tip alanı hakediş için gerçek yükseltme/düşürmeyi ayrıca ayırır.
  const now = new Date()
  const referralDiscountBps = getReferralDiscountBps(workshop, now)
  const catalogAmountMinor = getPlanPriceMinor(tier, cycle)
  const discountedAmountMinor = getDiscountedPlanPriceMinor(tier, cycle, referralDiscountBps)
  const previousOrder = type === "upgrade" || type === "downgrade"
    ? await prisma.billingOrder.findFirst({
        where: { workshopId: workshop.id, status: "confirmed" },
        orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }],
        select: { billingSnapshot: true },
      })
    : null
  const previousDiscountBps = getOrderReferralDiscountBps(previousOrder?.billingSnapshot)
  const amountMinor =
    tier === "lite" && workshop.liteFreeGrantedAt ? 0 :
    type === "upgrade" || type === "downgrade"
      ? computeUpgradeAmountMinor({
          currentTier: workshop.planTier as PlanTier,
          currentCycle: (workshop.billingCycle ?? "monthly") as BillingCycle,
          currentPeriodEnd: workshop.currentPeriodEnd,
          newTier: tier,
          newCycle: cycle,
          now,
          currentPriceMinor: getDiscountedPlanPriceMinor(workshop.planTier as PlanTier, (workshop.billingCycle ?? "monthly") as BillingCycle, previousDiscountBps),
          newPriceMinor: discountedAmountMinor,
        })
      : discountedAmountMinor
  const taxSnapshot = createBillingTaxSnapshot(amountMinor)

  const billingSnapshot = {
    invoiceTitle: data.invoiceTitle,
    taxNumber: data.taxNumber,
    taxOffice: data.taxOffice ?? "",
    name: workshop.name,
    address: workshop.address,
    email: workshop.email,
    phone: workshop.phone,
    referralDiscountBps,
    catalogAmountMinor,
  }

  // Persist invoice/tax info on the workshop, keep the legacy admin "talep"
  // badge working (requestedPlanTier), and create the order. Retry on the rare
  // reference collision (unique constraint).
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = generateOrderReference()
    try {
      const order = await prisma.$transaction(async (tx) => {
        if (!workshop.liteFreeGrantedAt) assertLiteRegistrationOpen(tier)
        await tx.workshop.update({
          where: { id: workshop.id },
          data: {
            invoiceTitle: data.invoiceTitle,
            taxNumber: data.taxNumber,
            taxOffice: data.taxOffice || null,
            requestedPlanTier: tier,
            planRequestedAt: new Date(),
          },
        })
        return tx.billingOrder.create({
          data: {
            workshopId: workshop.id,
            type,
            planTier: tier,
            previousPlanTier: type === "new_purchase" ? null : workshop.planTier,
            billingCycle: cycle,
            amountMinor,
            ...taxSnapshot,
            status: "pending_payment",
            method: data.method,
            reference,
            billingSnapshot,
          },
        })
      })

      await AuditLogAction(
        workshop.id,
        user.id,
        "BillingOrder",
        reference,
        "billing_order_created",
        JSON.stringify({ tier, cycle, amountMinor, catalogAmountMinor, referralDiscountBps, netAmountMinor: taxSnapshot.netAmountMinor, type, method: data.method })
      )
      const complimentary = (tier === "lite" && !!workshop.liteFreeGrantedAt) || isComplimentaryPlan(tier, cycle)
      if (complimentary) {
        const activation = await activateBillingOrder(order.id, {
          actor: "payment",
          confirmedByEmail: "opening-promotion",
        })
        if (!activation.ok) return activation
      }
      revalidatePath("/settings/plans")
      revalidatePath("/settings/billing")
      revalidatePath("/admin")
      return { ok: true, reference, amountMinor, method: data.method, complimentary }
    } catch (err) {
      if (err instanceof LiteRegistrationClosedError) return { ok: false, error: err.message }
      if ((err as { code?: string })?.code === "P2002") continue // reference collision → retry
      console.error("[createBillingOrder] failed:", err)
      return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
    }
  }
  return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
}

/** A card request can be withdrawn before the provider has an unsettled attempt.
 * The workshop row is shared with activation and payment initiation as a lock. */
export async function cancelPendingBillingOrder(reference: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, workshop } = await getCurrentUserWithWorkshop()
  if (!actorCan(user, "billing.manage")) return { ok: false, error: "Bu işlem için yetkiniz yok." }
  if (!/^BX-[A-Z0-9]+$/.test(reference)) return { ok: false, error: "Geçersiz sipariş." }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${workshop.id} FOR UPDATE`
      const order = await tx.billingOrder.findFirst({
        where: { reference, workshopId: workshop.id, status: "pending_payment" },
        include: { paymentTransactions: { where: { purpose: "purchase" }, select: { status: true, createdAt: true } } },
      })
      if (!order) return { ok: false as const, error: "Bekleyen sipariş bulunamadı. Sayfayı yenileyin." }
      if (order.method !== "card") return { ok: false as const, error: "Havale talebini iptal etmek için destek ekibiyle görüşün; ödeme yolda olabilir." }
      if (!canCancelPendingCardOrder(order.paymentTransactions, new Date())) {
        return { ok: false as const, error: "Kart işleminiz sürüyor veya son denemeniz yeni tamamlandı. Güvenli iptal için ödeme durumunu kontrol edip 24 saat sonra tekrar deneyin." }
      }
      const cancelled = await tx.billingOrder.updateMany({
        where: { id: order.id, workshopId: workshop.id, status: "pending_payment" },
        data: { status: "cancelled" },
      })
      if (!cancelled.count) return { ok: false as const, error: "Siparişin durumu değişti. Sayfayı yenileyin." }
      const otherPending = await tx.billingOrder.count({ where: { workshopId: workshop.id, status: "pending_payment" } })
      if (!otherPending) await tx.workshop.update({ where: { id: workshop.id }, data: { requestedPlanTier: null, planRequestedAt: null } })
      return { ok: true as const }
    })
    if (result.ok) {
      await AuditLogAction(workshop.id, user.id, "BillingOrder", reference, "billing_order_cancelled", JSON.stringify({ reason: "customer_request" }))
      revalidatePath("/settings/billing")
      revalidatePath("/settings/plans")
      revalidatePath("/admin")
    }
    return result
  } catch (error) {
    console.error("[cancelPendingBillingOrder] failed:", error)
    return { ok: false, error: "Talep iptal edilemedi. Lütfen tekrar deneyin." }
  }
}
