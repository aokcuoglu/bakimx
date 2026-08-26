import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2, SearchX } from "lucide-react"
import { can, getAdminContext } from "@/lib/admin"
import { getWorkshopRows } from "@/app/admin/data"
import { AdminWorkshops } from "@/app/admin/admin-workshops"
import {
  WORKSHOP_APPROVAL_OPTIONS,
  WORKSHOP_SUBSCRIPTION_OPTIONS,
  buildWorkshopListHref,
  isWorkshopListFiltered,
  parseWorkshopListParams,
  type WorkshopListQuery,
  type WorkshopListSearchParams,
} from "@/lib/admin-workshop-filters"
import { ACQUISITION_SOURCE_OPTIONS } from "@/lib/acquisition-sources"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FilterSelect } from "@/components/shared/filter-select"
import { EmptyState } from "@/components/shared/empty-state"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

/** Liste gövdesi — sorgu burada çalışır, böylece filtre değiştiğinde form
 *  anında çizilir ve yalnız bu bölüm yükleniyor durumuna düşer. */
async function WorkshopList({ query, canManage }: { query: WorkshopListQuery; canManage: boolean }) {
  const { rows, total, totalPages } = await getWorkshopRows(query)
  // Paylaşılan bir bağlantıdaki sayfa numarası artık aralık dışındaysa (kayıt
  // silindi ya da filtre daralttı) kullanıcı sayfalama düğmesi olmayan boş bir
  // ekranda kalırdı — son sayfaya taşı.
  if (query.page > totalPages) redirect(buildWorkshopListHref(query, totalPages))
  const filtered = isWorkshopListFiltered(query)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {filtered ? `${total} sonuç` : `${total} iş yeri`}
        {totalPages > 1 && (
          <span>
            {" "}
            · sayfa {query.page} / {totalPages}
          </span>
        )}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={filtered ? SearchX : Building2}
          title={filtered ? "Eşleşen iş yeri yok" : "Henüz iş yeri yok"}
          description={
            filtered
              ? "Aramayı sadeleştirin ya da filtreleri temizleyin."
              : "İlk kayıt açıldığında burada listelenir."
          }
          action={filtered ? { label: "Filtreleri temizle", href: "/admin/workshops" } : undefined}
        />
      ) : (
        <AdminWorkshops workshops={rows} canManage={canManage} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Sayfa {query.page} / {totalPages}
          </span>
          <div className="flex gap-2">
            {query.page > 1 && (
              <Button variant="outline" asChild>
                <Link href={buildWorkshopListHref(query, query.page - 1)}>
                  Önceki
                </Link>
              </Button>
            )}
            {query.page < totalPages && (
              <Button variant="outline" asChild>
                <Link href={buildWorkshopListHref(query, query.page + 1)}>
                  Sonraki
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default async function AdminWorkshopsPage({
  searchParams,
}: {
  // `searchParams` bir Promise'tir ve `await` edilmelidir; doğrudan okumak
  // typecheck yeşilken çalışma zamanında `undefined` verir (AGENTS.md, PR #336).
  searchParams: Promise<WorkshopListSearchParams>
}) {
  const ctx = await getAdminContext()
  const query = parseWorkshopListParams(await searchParams)
  const filtered = isWorkshopListFiltered(query)
  const advisors = await prisma.salesAdvisor.findMany({ where: { disabledAt: null }, include: { user: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: "asc" } })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">İş Yerleri</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Yeni kayıtları görüntüleyin, paket taleplerini etkinleştirin. Detay için iş yeri adına tıklayın.
        </p>
      </div>

      {/* GET formu — filtreler URL'de yaşar, böylece ekran destek görüşmesinde
          bağlantı olarak paylaşılabilir. Gönderimde `page` taşınmadığı için
          arama/filtre değişince liste birinci sayfaya döner. */}
      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground sm:min-w-56">
          Ara
          <Input
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="İş yeri adı veya e-posta"
            aria-label="İş yeri adı veya e-posta ile ara"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Onay durumu
          <FilterSelect
            name="approval"
            defaultValue={query.approval ?? ""}
            placeholder="Tümü"
            options={WORKSHOP_APPROVAL_OPTIONS}
            className="w-full sm:w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Edinim kaynağı
          <FilterSelect name="acquisitionSource" defaultValue={query.acquisitionSource ?? ""} placeholder="Tümü" options={[{ value: "", label: "Tümü" }, ...ACQUISITION_SOURCE_OPTIONS]} className="w-full sm:w-44" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Satış temsilcisi
          <FilterSelect name="acquisitionAdvisorId" defaultValue={query.acquisitionAdvisorId ?? ""} placeholder="Tümü" options={[{ value: "", label: "Tümü" }, ...advisors.map((a) => ({ value: a.id, label: [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || a.user.email || "—" }))]} className="w-full sm:w-48" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Abonelik
          <FilterSelect
            name="subscription"
            defaultValue={query.subscription ?? ""}
            placeholder="Tümü"
            options={WORKSHOP_SUBSCRIPTION_OPTIONS}
            className="w-full sm:w-44"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit">Filtrele</Button>
          {filtered && (
            <Button variant="ghost" asChild>
              <Link href="/admin/workshops">
                Temizle
              </Link>
            </Button>
          )}
        </div>
      </form>

      {/* `key` sorguyu içerir: filtre/sayfa değişince bu sınır yeniden askıya
          alınır ve kullanıcı boş ekran yerine spinner görür. */}
      <Suspense
        key={buildWorkshopListHref(query)}
        fallback={
          <div className="flex min-h-64 items-center justify-center">
            <BrandSpinner size={48} label="Yükleniyor…" />
          </div>
        }
      >
        <WorkshopList query={query} canManage={can(ctx, "manageWorkshops")} />
      </Suspense>
    </div>
  )
}
