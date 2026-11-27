"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { requireWritableWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { resolveBillingAccount } from "@/lib/billing/account"
import { addonFeaturesFor, evaluateAddonOrderEligibility, priceAddonOrder } from "@/lib/billing/addon-pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import { createBillingTaxSnapshot } from "@/lib/billing/tax"
import { hasWorkshopFeature } from "@/lib/plan"
import { releaseExpiredAddonOrders } from "@/lib/billing/release-expired-addon-orders"
import { addonOrderSchema } from "@/lib/validations/addon-order"

export type CreateAddonOrderInput = {
  items: { key: string; quantity: number }[]
  method?: string
  invoiceTitle: string
  taxNumber: string
  taxOffice?: string
}

export type CreateAddonOrderResult =
  | { ok: true; reference: string; amountMinor: number; method: "card" | "havale" }
  | { ok: false; error: string }

/**
 * Açık ücretli dönemde ek özellik siparişi (#829). Yalnız oturumdaki atölye,
 * yalnız hesap (ana) atölyesi; tutar sunucuda `priceAddonOrder` ile hesaplanır.
 * Paket yazma kilidi (`requireWritableWorkshop`) bilerek aktif: dönemi bitmiş
 * atölye ek özellik alamaz, önce paketi yenilemelidir.
 */
export async function createAddonOrder(input: CreateAddonOrderInput): Promise<CreateAddonOrderResult> {
  const { user, workshop } = await requireWritableWorkshop("billing.manage")

  const parsed = addonOrderSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }
  const data = parsed.data

  const account = await resolveBillingAccount(workshop)
  const now = new Date()
  const periodEnd = workshop.currentPeriodEnd

  const pendingScope = { OR: [{ workshopId: workshop.id }, { workshop: { taxNumber: data.taxNumber } }] }
  await releaseExpiredAddonOrders(pendingScope, now)
  const duplicatePending = await prisma.billingOrder.findFirst({
    where: { status: "pending_payment", ...pendingScope },
    select: { workshopId: true },
  })

  const eligibility = evaluateAddonOrderEligibility({
    isAccountWorkshop: account.isAccountWorkshop,
    subscriptionStatus: workshop.subscriptionStatus,
    currentPeriodEnd: periodEnd,
    now,
    items: data.items.map((item) => ({
      key: item.key,
      owned: addonFeaturesFor([item.key]).every((f) => hasWorkshopFeature(workshop, f)),
    })),
    pending: duplicatePending ? (duplicatePending.workshopId === workshop.id ? "own" : "tax") : null,
  })
  if (!eligibility.ok || !periodEnd) {
    return { ok: false, error: eligibility.ok ? "Geçersiz bilgiler" : eligibility.error }
  }

  const cycle = workshop.billingCycle ?? "monthly"
  const priced = priceAddonOrder({ items: data.items, cycle, currentPeriodEnd: periodEnd, now })
  const amountMinor = priced.amountMinor
  const taxSnapshot = createBillingTaxSnapshot(amountMinor)
  const billingSnapshot = {
    invoiceTitle: data.invoiceTitle,
    taxNumber: data.taxNumber,
    taxOffice: data.taxOffice ?? "",
    name: workshop.name,
    address: workshop.address,
    email: workshop.email,
    phone: workshop.phone,
    fullCycleAmountMinor: priced.fullCycleAmountMinor,
  }
  const addonLines = priced.lines as unknown as Prisma.InputJsonValue

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
          },
        })
        await tx.billingOrder.create({
          data: {
            workshopId: workshop.id,
            type: "addon",
            planTier: workshop.planTier,
            previousPlanTier: null,
            billingCycle: cycle,
            amountMinor,
            ...taxSnapshot,
            status: "pending_payment",
            method: data.method,
            reference,
            billingSnapshot,
            addonLines,
          },
        })
      })

      await AuditLogAction(
        workshop.id,
        user.id,
        "BillingOrder",
        reference,
        "billing_addon_order_created",
        JSON.stringify({
          items: priced.lines.map((l) => ({ key: l.key, quantity: l.quantity, amountMinor: l.amountMinor })),
          cycle,
          amountMinor,
          netAmountMinor: taxSnapshot.netAmountMinor,
          method: data.method,
        }),
      )
      revalidatePath("/settings/plans")
      revalidatePath("/settings/billing")
      revalidatePath("/admin")
      return { ok: true, reference, amountMinor, method: data.method }
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue
      console.error("[createAddonOrder] failed:", err)
      return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
    }
  }
  return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
}
