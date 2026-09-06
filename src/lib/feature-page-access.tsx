import { FeaturePaywall } from "@/components/billing/feature-paywall"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPlanState, hasWorkshopFeature, type GatedFeature } from "@/lib/plan"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { connection } from "next/server"

async function countPreservedItems(workshopId: string, feature: GatedFeature): Promise<number> {
  switch (feature) {
    case "quotes":
      return prisma.quote.count({ where: { workshopId } })
    case "appointments":
      return prisma.appointment.count({ where: { workshopId } })
    case "automatedReminders":
      return prisma.maintenanceReminder.count({ where: { workshopId } })
    case "team":
      return prisma.technician.count({ where: { workshopId } })
    case "partsInventory":
      return prisma.partStockItem.count({ where: { workshopId } })
    case "procurement": {
      const [suppliers, externalOrders, bakimxOrders] = await Promise.all([
        prisma.supplier.count({ where: { workshopId } }),
        prisma.externalProcurementOrder.count({ where: { workshopId } }),
        prisma.bakimxOrder.count({ where: { workshopId } }),
      ])
      return suppliers + externalOrders + bakimxOrders
    }
    case "cashbox":
      return prisma.collectionPayment.count({ where: { workshopId } })
    case "analytics":
    case "reports":
    case "eInvoice":
      return prisma.serviceOrder.count({ where: { workshopId } })
    case "communications":
      return prisma.communicationLog.count({ where: { workshopId } })
    case "vehiclePassport":
      return prisma.vehiclePassportToken.count({ where: { workshopId } })
    case "bakimxCatalog":
      return prisma.bakimxOrder.count({ where: { workshopId } })
    case "getirbakimCatalog":
      return prisma.externalProcurementOrder.count({ where: { workshopId } })
    case "photoChecklist":
      return prisma.vehiclePhoto.count({ where: { workshopId, ...VISIBLE_PHOTO } })
    case "damageMap":
      return prisma.damageMark.count({ where: { workshopId } })
    case "ocrIntake":
    case "vinLookup":
      return prisma.vehicle.count({ where: { workshopId } })
    case "partsCatalog":
      return prisma.serviceOrder.count({ where: { workshopId } })
    case "multiBranch":
    case "rbac":
      return 0
  }
}

/**
 * Page-local guard. Call before params or feature data is read; layouts alone
 * are insufficient under App Router partial rendering.
 */
export async function getFeaturePaywall(feature: GatedFeature) {
  // Next.js 16 may otherwise try to prerender a guarded leaf page before a
  // session exists. This helper always resolves entitlement from the request.
  await connection()
  const { workshop } = await getCurrentUserWithWorkshop()
  if (hasWorkshopFeature(workshop, feature)) return null
  const itemCount = await countPreservedItems(workshop.id, feature)
  return (
    <FeaturePaywall
      feature={feature}
      currentTier={getPlanState(workshop).tier}
      itemCount={itemCount}
    />
  )
}
