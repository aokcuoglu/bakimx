import Form from "next/form"
import Link from "next/link"
import { ArrowLeft, PackageSearch, Search } from "lucide-react"
import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { surface } from "@/components/dashboard/surface"
import { formatTRY } from "@/lib/format"
import {
  normalizePartQuery,
  searchTechnicianParts,
  TECHNICIAN_PART_QUERY_MAX_LENGTH,
  TECHNICIAN_PART_SEARCH_LIMIT,
  type TechnicianPartRow,
} from "@/lib/technician/parts-search"

export const metadata = { title: "Parça Sorgulama" }

export const dynamic = "force-dynamic"

export default async function TechnicianPartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const paywall = await getFeaturePaywall("partsInventory")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const query = normalizePartQuery((await searchParams).q)
  const parts = await searchTechnicianParts(user.workshopId, query)

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Parça Sorgulama">
      <div className="space-y-4 sm:space-y-5">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/technician">
              <ArrowLeft aria-hidden="true" />
              Teknisyen Paneli
            </Link>
          </Button>
          <h2 className={surface.heroTitle}>Parça Sorgulama</h2>
          <p className={surface.heroSub}>
            Parça adı, stok kodu, OEM no, marka veya barkod ile arayın
          </p>
        </div>

        <Form action="/technician/parts" role="search" className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Ör. fren balatası, 04465…"
            aria-label="Parça ara"
            maxLength={TECHNICIAN_PART_QUERY_MAX_LENGTH}
            autoComplete="off"
            enterKeyHint="search"
            autoFocus={!query}
            className="flex-1"
          />
          <Button type="submit" variant="foreground">
            <Search aria-hidden="true" />
            Ara
          </Button>
        </Form>

        {!query ? (
          <EmptyState
            title="Aramaya başlayın"
            description="Stoktaki parçanın adedini ve satış fiyatını görmek için arama yapın."
          />
        ) : parts.length === 0 ? (
          <EmptyState
            title="Sonuç bulunamadı"
            description={`“${query}” için stokta aktif parça yok.`}
          />
        ) : (
          <section className="space-y-2" aria-label="Arama sonuçları">
            <p className="px-1 text-sm text-muted-foreground">
              {parts.length} sonuç
              {parts.length === TECHNICIAN_PART_SEARCH_LIMIT && " · aramayı daraltın, ilk 50 kayıt gösteriliyor"}
            </p>
            <Card className="gap-0 py-0">
              <ul className="divide-y divide-border">
                {parts.map((part) => (
                  <PartRow key={part.id} part={part} />
                ))}
              </ul>
            </Card>
          </section>
        )}
      </div>
    </AppShell>
  )
}

function PartRow({ part }: { part: TechnicianPartRow }) {
  const codes = [part.sku, part.oemNo && `OEM ${part.oemNo}`].filter(Boolean).join(" · ")
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">{part.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[part.brand, part.category].filter(Boolean).join(" · ") || "—"}
        </p>
        {codes && <p className="truncate font-mono text-xs text-muted-foreground">{codes}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StockBadge part={part} />
        <span className="text-base font-semibold text-foreground">
          {part.salePrice != null ? formatTRY(part.salePrice) : "Fiyat yok"}
        </span>
      </div>
    </li>
  )
}

function StockBadge({ part }: { part: TechnicianPartRow }) {
  const label = `${part.stockQty} ${part.unit}`
  if (part.stockQty <= 0) {
    return (
      <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive-strong">
        Stokta yok
      </Badge>
    )
  }
  if (part.stockQty <= part.criticalStockQty) {
    return (
      <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning-strong">
        {label} · kritik
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-success/20 bg-success/10 text-success-strong">
      {label}
    </Badge>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="max-w-sm text-base text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
