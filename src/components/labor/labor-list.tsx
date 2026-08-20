"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KpiStat } from "@/components/ui/kpi-stat"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PartsTabsNav } from "@/app/(app)/parts/parts-tabs-nav"
import { LaborItemDialog } from "@/components/labor/labor-item-dialog"
import { LaborPresetImportDialog } from "@/components/labor/labor-preset-import-dialog"
import { searchLaborItems } from "@/lib/labor/search"
import { formatPrice } from "@/lib/parts/format"
import type { LaborCatalogRow, LaborKPIs } from "@/lib/labor/types"
import { Plus, Search, Wrench, Archive, Edit3, Trash2, Sparkles, CheckCircle2, Loader2 } from "lucide-react"

export function LaborList({
  items, kpis, categories, currentFilters,
}: {
  items: LaborCatalogRow[]
  kpis: LaborKPIs
  categories: string[]
  currentFilters: { q: string; status: string }
}) {
  const router = useRouter()
  const [search, setSearch] = useState(currentFilters.q)
  const [status, setStatus] = useState(currentFilters.status || "all")
  const [editing, setEditing] = useState<LaborCatalogRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<LaborCatalogRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Liste küçük (atölye başına onlarca kalem) → filtreleme istemcide, sunucu turu yok.
  const visible = useMemo(() => {
    const byStatus = items.filter((i) =>
      status === "active" ? i.isActive : status === "inactive" ? !i.isActive : true
    )
    return searchLaborItems(byStatus, search)
  }, [items, status, search])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(item: LaborCatalogRow) {
    setEditing(item)
    setDialogOpen(true)
  }

  async function handleDeactivate(id: string) {
    setBusyId(id)
    const { deactivateLaborItemAction } = await import("@/app/(app)/parts/labor-actions")
    const res = await deactivateLaborItemAction(id)
    if ("error" in res) toast.error(res.error)
    else router.refresh()
    setBusyId(null)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    const { deleteLaborItemAction } = await import("@/app/(app)/parts/labor-actions")
    const res = await deleteLaborItemAction(pendingDelete.id)
    if ("error" in res) toast.error(res.error)
    else {
      toast.success("İşçilik silindi")
      router.refresh()
    }
    setPendingDelete(null)
    setBusyId(null)
  }

  const isEmpty = items.length === 0

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Stok / Parçalar</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <Wrench className="size-5 text-primary" />
          Stok / Parçalar
        </h2>
        <Button size="sm" className="w-full sm:w-auto" onClick={openCreate}>
          <Plus className="size-3.5 mr-1" /> Yeni İşçilik
        </Button>
      </div>

      <PartsTabsNav active="labor" />

      <div className="grid grid-cols-3 gap-3">
        <KpiStat label="Toplam İşçilik" value={kpis.total} icon={Wrench} accent="text-primary" accentBg="bg-primary/10" />
        <KpiStat label="Aktif" value={kpis.active} icon={CheckCircle2} accent="text-success-strong" accentBg="bg-success/10" />
        <KpiStat label="Pasif" value={kpis.inactive} icon={Archive} accent="text-muted-foreground" accentBg="bg-muted" />
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center">
          <Wrench className="size-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Henüz işçilik tanımlanmadı</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4 px-4">
            Tanımladığınız işçilikler iş emri ve teklif ekranlarında öneri olarak çıkar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 px-4">
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5 mr-1" /> Yeni İşçilik
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Sparkles className="size-3.5 mr-1" /> Hazır listeden ekle
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İşçilik adı, kod veya kategori ara…"
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={(v) => setStatus(v)}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Sparkles className="size-3.5 mr-1" /> Hazır listeden ekle
              </Button>
            </CardContent>
          </Card>

          <div className="hidden md:block">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <Th>Kod</Th>
                    <Th>İşçilik</Th>
                    <Th>Kategori</Th>
                    <Th align="right">Varsayılan Ücret</Th>
                    <Th align="center">Durum</Th>
                    <Th align="right">İşlem</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((item) => (
                    <tr key={item.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {item.code || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{item.name}</span>
                        {item.description && (
                          <span className="block text-[11px] text-muted-foreground truncate max-w-xs">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {item.category || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-foreground tabular-nums">
                        {formatPrice(item.defaultPriceKurus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                <Edit3 className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Düzenle</TooltipContent>
                          </Tooltip>
                          {item.isActive && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={busyId === item.id} onClick={() => handleDeactivate(item.id)}>
                                  <Archive className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Pasifleştir</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={busyId === item.id} onClick={() => setPendingDelete(item)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Sil</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Wrench className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                  Aramanızla eşleşen işçilik bulunamadı
                </div>
              )}
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {visible.map((item) => (
              <Card key={item.id} size="sm">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.code && (
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {item.code}
                          </span>
                        )}
                        {item.category && <span className="text-[11px] text-muted-foreground">{item.category}</span>}
                      </div>
                    </div>
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground tabular-nums">
                      {formatPrice(item.defaultPriceKurus)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label="Düzenle" onClick={() => openEdit(item)}>
                        <Edit3 className="size-3.5" />
                      </Button>
                      {item.isActive && (
                        <Button variant="ghost" size="icon" aria-label="Pasifleştir" disabled={busyId === item.id} onClick={() => handleDeactivate(item.id)}>
                          <Archive className="size-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label="Sil" disabled={busyId === item.id} onClick={() => setPendingDelete(item)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {visible.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Wrench className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                Aramanızla eşleşen işçilik bulunamadı
              </div>
            )}
          </div>
        </>
      )}

      <LaborItemDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editing} categories={categories} />
      <LaborPresetImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşçilik silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{pendingDelete?.name}&quot; tanımı listenizden kaldırılacak. Geçmiş iş emirleri
              ve teklifler bundan etkilenmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId === pendingDelete?.id}
              onClick={confirmDelete}
            >
              {busyId === pendingDelete?.id && <Loader2 className="size-4 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Hizalama açık eşlemeyle verilir: `text-${align}` şablon dizisini Tailwind'in
// JIT taraması GÖRMEZ ve sınıf hiç üretilmez.
const TH_ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const

function Th({ children, align = "left" }: { children: React.ReactNode; align?: keyof typeof TH_ALIGN }) {
  return (
    <th className={`${TH_ALIGN[align]} px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider`}>
      {children}
    </th>
  )
}
