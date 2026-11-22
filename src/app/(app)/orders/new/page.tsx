import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { IntakeWizard } from "@/components/intake/intake-wizard"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { surface } from "@/components/dashboard/surface"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { getPlanState } from "@/lib/plan"
import { parseEntryMethod } from "@/lib/intake/entry-wizard"

export const metadata = { title: "Yeni Araç Kabul" }

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string; source?: string; entry?: string; from?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams

  const initialEntryMethod = parseEntryMethod(params.entry)
  // Doğrudan giriş (teknisyen panelindeki Araç Kabul kartı): adım rayı yok,
  // breadcrumb yerine geri bağlantısı. Saha rolleri /orders'a giremez, onlar
  // için geri hedefi panelleridir.
  const focused = initialEntryMethod != null
  const back = isTechnicianRestrictedRole(user.role) || params.from === "technician"
    ? { href: "/technician", label: "Teknisyen Paneli" }
    : { href: "/orders", label: "Araç Kabulleri" }

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: { firstName: "asc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle={focused ? "Araç Kabul" : "Yeni Araç Kabul"}>
      <div className={focused ? "mx-auto max-w-3xl space-y-5 sm:space-y-6" : "mx-auto max-w-6xl space-y-5 sm:space-y-6"}>
        {focused ? (
          <div className="space-y-1">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link href={back.href}>
                <ArrowLeft aria-hidden="true" />
                {back.label}
              </Link>
            </Button>
            <h2 className={surface.heroTitle}>Araç Kabul</h2>
          </div>
        ) : (
          <>
            <div className="flex items-center text-sm text-muted-foreground">
              <Link href="/orders" className="hover:text-foreground">Araç Kabulleri</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground font-medium">Yeni</span>
            </div>
            <div>
              <h2 className="text-page-title text-foreground">Yeni Araç Kabul</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Adım adım araç kabul formu oluşturun</p>
            </div>
          </>
        )}
        <IntakeWizard
          customers={customers}
          prefillCustomerId={params.customerId}
          prefillVehicleId={params.vehicleId}
          source={params.source}
          initialEntryMethod={initialEntryMethod}
          planTier={workshop ? getPlanState(workshop).accessTier : "pro"}
        />
      </div>
    </AppShell>
  )
}
