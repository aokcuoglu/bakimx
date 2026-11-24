import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { IntakeWizard } from "@/components/intake/intake-wizard"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { getPlanState } from "@/lib/plan"
import { parseEntryMethod } from "@/lib/intake/entry-wizard"
import { parseIntakeBack } from "@/lib/intake/entry-links"
import { displayCustomerName } from "@/lib/search/unified-results"
import { detectPlate } from "@/lib/plate/country"

export const metadata = { title: "Yeni Araç Kabul" }

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string; source?: string; entry?: string; from?: string; back?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams

  const initialEntryMethod = parseEntryMethod(params.entry)
  // Doğrudan giriş (teknisyen panelindeki Araç Kabul kartı): adım rayı yok,
  // breadcrumb yerine geri bağlantısı. Saha rolleri /orders'a giremez, onlar
  // için geri hedefi panelleridir.
  const focused = initialEntryMethod != null

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: { firstName: "asc" },
  })

  // Geri bağlantısı kabulün açıldığı sayfaya döner (#842): `back` yalnız izin
  // listesindeki iç adreslerden biri olabilir. Müşteri adı ve plaka atölyeye göre
  // süzülmüş veriden gelir; bulunamazsa genel etiket kalır (hedef sayfa kendi
  // yetki kontrolünü yapar).
  let back = { href: "/orders", label: "Araç Kabulleri" }
  if (isTechnicianRestrictedRole(user.role) || params.from === "technician") {
    back = { href: "/technician", label: "Servis Yönetimi" }
  } else if (focused) {
    const target = parseIntakeBack(params.back)
    if (target?.kind === "page") {
      back = { href: target.href, label: target.label }
    } else if (target?.kind === "customer") {
      const customer = customers.find((c) => c.id === target.id)
      back = { href: target.href, label: customer ? displayCustomerName(customer) : "Müşteri" }
    } else if (target?.kind === "vehicle") {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: target.id, workshopId: user.workshopId },
        select: { plate: true },
      })
      back = { href: target.href, label: vehicle ? detectPlate(vehicle.plate).text : "Araç" }
    }
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle={focused ? "Araç Kabul" : "Yeni Araç Kabul"}>
      <div className={focused ? "mx-auto max-w-3xl space-y-5 sm:space-y-6" : "mx-auto max-w-6xl space-y-5 sm:space-y-6"}>
        {focused ? (
          <div>
            {/* Etiket müşteri adı olabilir (uzun firma adı): telefonda sayfayı
                yana taşırmasın, üç noktayla kısalsın (#842). */}
            <Button variant="ghost" asChild className="-ml-3 max-w-[calc(100%+0.75rem)] text-base">
              <Link href={back.href}>
                <ArrowLeft aria-hidden="true" />
                <span className="min-w-0 truncate">{back.label}</span>
              </Link>
            </Button>
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
