"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { requireWritableWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { resolveBillingAccount } from "@/lib/billing/account"
import { addonFeaturesFor, priceAddonOrder } from "@/lib/billing/addon-pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import { createBillingTaxSnapshot } from "@/lib/billing/tax"
import { hasWorkshopFeature } from "@/lib/plan"
import { ADDON_CATALOG } from "@/lib/plans-catalog"
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
  if (!account.isAccountWorkshop) {
    return { ok: false, error: "Ek özellikler ana şubeden satın alınır." }
  }

  const now = new Date()
  const periodEnd = workshop.currentPeriodEnd
  if (workshop.subscriptionStatus !== "active" || !periodEnd || periodEnd.getTime() <= now.getTime()) {
    return { ok: false, error: "Ek özellik almak için önce geçerli bir Servis Paketi dönemi gerekir." }
  }

  for (const item of data.items) {
    const catalog = ADDON_CATALOG.find((a) => a.key === item.key)
    if (!catalog?.purchasable) {
      return { ok: false, error: "Bu ek özellik şu an satın alınamaz." }
    }
    if (addonFeaturesFor([item.key]).every((f) => hasWorkshopFeature(workshop, f))) {
      return { ok: false, error: `${catalog.name} zaten hesabınızda açık.` }
    }
  }

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
          ? "Zaten bekleyen bir talebiniz var. Ödemeniz onaylanana kadar yeni bir talep oluşturamazsınız."
          : "Bu vergi/TC kimlik numarasına ait bekleyen bir talep zaten var.",
    }
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
