import { requireAdmin } from "@/lib/admin"
import { getBillingData } from "@/app/admin/data"
import { AdminBilling } from "@/app/admin/admin-billing"

export const dynamic = "force-dynamic"

export default async function AdminBillingPage() {
  await requireAdmin()
  const { orderRows, subscriptions, revenue } = await getBillingData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Faturalandırma</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Havaleleri teyit edin, abonelikleri ve geliri görün.
        </p>
      </div>
      <AdminBilling orders={orderRows} subscriptions={subscriptions} revenue={revenue} />
    </div>
  )
}
