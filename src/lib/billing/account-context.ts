import "server-only"

import { redirect } from "next/navigation"
import { getAppData } from "@/app/(app)/data"
import { resolveBillingAccount } from "@/lib/billing/account"
import { prisma } from "@/lib/db"
import { isAddonOrderKey } from "@/lib/billing/addon-pricing"
import { getPlanState, type PlanTier } from "@/lib/plan"
import { getPlanPackage } from "@/lib/plans-catalog"
import { getSeatUsage } from "@/lib/rbac"
import { actorCan } from "@/lib/roles"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"

/** Account subpages share the former /billing visibility boundary. */
export async function getAccountBillingContext() {
  const { user, workshop } = await getAppData()
  if (isTechnicianRestrictedRole(user.role)) redirect("/settings/account")
  if (!workshop) redirect("/dashboard")

  const [pendingOrder, seatUsage, account] = await Promise.all([
    prisma.billingOrder.findFirst({
      where: { workshopId: workshop.id, status: "pending_payment" },
      orderBy: { createdAt: "desc" },
    }),
    getSeatUsage(workshop.id),
    resolveBillingAccount(workshop),
  ])
  const plan = getPlanState(workshop)
  const ownedTier = workshop.subscriptionStatus === "active" ? (workshop.planTier as PlanTier) : null
  const planName = getPlanPackage(ownedTier ?? plan.tier)?.name ?? plan.tier

  return {
    user, workshop, plan, ownedTier, planName, pendingOrder, seatUsage,
    isAccountWorkshop: account.isAccountWorkshop,
    /** Yenilemede tahsil edilecek satın alınmış ek özellikler; yalnız hesap atölyesinde (#1049). */
    paidAddonKeys: account.isAccountWorkshop ? workshop.paidAddons.filter(isAddonOrderKey) : [],
    canPurchase: actorCan(user, "billing.manage"),
  }
}
