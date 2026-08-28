"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { checkoutInAppSchema } from "@/lib/validations/billing"
import { getPlanPriceMinor } from "@/lib/billing/pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import { computeUpgradeAmountMinor } from "@/lib/billing/proration"
import { deriveBillingOrderType } from "@/lib/billing/order-type"
import { createBillingTaxSnapshot } from "@/lib/billing/tax"
import type { BillingCycle } from "@prisma/client"
import type { PlanTier } from "@/lib/plan"
import { roleCan } from "@/lib/roles"

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
  | { ok: true; reference: string; amountMinor: number; method: "card" | "havale" }
  | { ok: false; error: string }
> {
  const { user, workshop } = await getCurrentUserWithWorkshop()
  // Rol kapısı EVET, plan yazma kilidi HAYIR: satın alma tam da planı bitmiş
  // atölyenin yapacağı iş; requireWritableWorkshop burada checkout'u kilitlerdi.
  if (!roleCan(user.role, "billing.manage")) {
    return { ok: false, error: "Bu işlem için yetkiniz yok." }
  }

  const parsed = checkoutInAppSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }
  const data = parsed.data
  const tier = data.tier as PlanTier
  const cycle = data.cycle as BillingCycle

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
  const amountMinor =
    type === "upgrade" || type === "downgrade"
      ? computeUpgradeAmountMinor({
          currentTier: workshop.planTier as PlanTier,
          currentCycle: (workshop.billingCycle ?? "monthly") as BillingCycle,
          currentPeriodEnd: workshop.currentPeriodEnd,
          newTier: tier,
          newCycle: cycle,
          now: new Date(),
        })
      : getPlanPriceMinor(tier, cycle)
  const taxSnapshot = createBillingTaxSnapshot(amountMinor)

  const billingSnapshot = {
    invoiceTitle: data.invoiceTitle,
    taxNumber: data.taxNumber,
    taxOffice: data.taxOffice ?? "",
    name: workshop.name,
    address: workshop.address,
    email: workshop.email,
    phone: workshop.phone,
  }

  // Persist invoice/tax info on the workshop, keep the legacy admin "talep"
  // badge working (requestedPlanTier), and create the order. Retry on the rare
  // reference collision (unique constraint).
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = generateOrderReference()
    try {
      await prisma.$transaction(async (tx) => {
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
        await tx.billingOrder.create({
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
        JSON.stringify({ tier, cycle, amountMinor, netAmountMinor: taxSnapshot.netAmountMinor, type, method: data.method })
      )
      revalidatePath("/billing")
      revalidatePath("/admin")
      return { ok: true, reference, amountMinor, method: data.method }
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue // reference collision → retry
      console.error("[createBillingOrder] failed:", err)
      return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
    }
  }
  return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
}
