"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { checkoutInAppSchema } from "@/lib/validations/billing"
import { getPlanPriceMinor } from "@/lib/billing/pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import type { BillingCycle, BillingOrderType } from "@prisma/client"
import type { PlanTier } from "@/lib/plan"

/**
 * Creates a pending-payment BillingOrder for the current workshop (upgrade /
 * renewal / first paid purchase). An admin later confirms the havale in /admin,
 * which activates the plan. workshopId is derived from the session — never the
 * client — to preserve tenant isolation.
 */
export async function createBillingOrder(input: {
  tier: string
  cycle: string
  invoiceTitle: string
  taxNumber: string
  taxOffice?: string
}): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const { user, workshop } = await getCurrentUserWithWorkshop()

  const parsed = checkoutInAppSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }
  const data = parsed.data
  const tier = data.tier as PlanTier
  const cycle = data.cycle as BillingCycle
  const amountMinor = getPlanPriceMinor(tier, cycle)

  const type: BillingOrderType =
    workshop.currentPeriodEnd == null
      ? "new_purchase"
      : workshop.subscriptionStatus === "active" && workshop.planTier === tier
        ? "renewal"
        : "upgrade"

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
            billingCycle: cycle,
            amountMinor,
            status: "pending_payment",
            method: "havale",
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
        JSON.stringify({ tier, cycle, amountMinor, type })
      )
      revalidatePath("/billing")
      revalidatePath("/admin")
      return { ok: true, reference }
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue // reference collision → retry
      console.error("[createBillingOrder] failed:", err)
      return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
    }
  }
  return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
}
