"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Loader2, Package, Pencil, Store, Trash2, Wrench } from "lucide-react"
import { toast } from "sonner"
import { formatTRY } from "@/lib/format"
import { formatTrDate } from "@/lib/format-date"
import { externalLaborPaidKurus } from "@/lib/orders/external-labor-cost"
import type { PurchaseDeleteDecision } from "@/lib/orders/purchase-delete"
import type { PurchasePhoto } from "@/lib/photos/purchase-photos"
import { removePurchaseItemAction } from "@/app/(app)/orders/actions"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"
import { PhotoThumbnail } from "@/components/technician/work-screen/work-details"
import type { TechnicianOrderItem } from "@/components/technician/work-screen/types"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * "Dış Alımlar" kartı — dışarıdan alınan parçalar VE dış işçilik kalemleri.
 * Ekleme kutucuklardan yapılır; burada yalnız kayıtlı olanlar listelenir
 * (hiç yoksa kart hiç çizilmez). Düzenleme yüzeyini üst bileşen açar.
 */
export function PurchaseCards({
  orderId,
  locked,
  purchases,
  laborItems,
  photosByItem,
  deleteDecision,
  canDeleteLabor,
  onEditPurchase,
  onEditLabor,
}: {
  orderId: string
  locked: boolean
  purchases: TechnicianOrderItem[]
  laborItems: TechnicianOrderItem[]
  photosByItem: Map<string, PurchasePhoto[]>
  deleteDecision: PurchaseDeleteDecision
  canDeleteLabor: boolean
  onEditPurchase: (item: TechnicianOrderItem) => void
  onEditLabor: (item: TechnicianOrderItem) => void
}) {
  if (purchases.length === 0 && laborItems.length === 0) return null

  const totalKurus =
    purchases.reduce((sum, i) => sum + (i.purchasePriceKurus ?? 0), 0) +
    laborItems.reduce((sum, i) => sum + (externalLaborPaidKurus(i) ?? 0) * i.quantity, 0)
  const hasAnyPrice =
    purchases.some((i) => i.purchasePriceKurus != null) || laborItems.some((i) => externalLaborPaidKurus(i) != null)

  return (
    <section className="space-y-3 rounded-xl bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Dış Alımlar</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aldığın parçalar ve yaptırdığın işçilikler araç kabul toplamına eklenir.
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {hasAnyPrice ? formatTRY(totalKurus) : "—"}
        </span>
      </div>

      {laborItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Wrench className="size-4 text-warning-strong" />
            Dış İşçilik
            <span className="text-xs font-normal text-muted-foreground">({laborItems.length})</span>
          </h3>
          {laborItems.map((item) => (
            <ExternalLaborCard
              key={item.id}
              item={item}
              orderId={orderId}
              deletable={!locked && canDeleteLabor}
              editable={!locked && canDeleteLabor}
              onEdit={() => onEditLabor(item)}
            />
          ))}
        </div>
      )}

      {purchases.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Package className="size-4 text-primary-strong" />
            Dışarıdan Alınan Parçalar
            <span className="text-xs font-normal text-muted-foreground">({purchases.length})</span>
          </h3>
          {purchases.map((item) => (
            <PurchaseCard
              key={item.id}
              item={item}
              photos={photosByItem.get(item.id) ?? []}
              orderId={orderId}
              deleteDecision={deleteDecision}
              onEdit={() => onEditPurchase(item)}
            />
          ))}
          {!deleteDecision.allowed && (
            <p className="text-xs text-muted-foreground">{deleteDecision.reason}</p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Dış alım kartı: solda kutu fotoğrafı (yoksa simge karesi), sağda tutar,
 * altında tedarikçi/tarih/katalog bilgisi ve aksiyonlar. Fotoğrafa dokunmak
 * galeri lightbox'ını açar (BAK-111).
 */
function PurchaseCard({
  item, photos, orderId, deleteDecision, onEdit,
}: {
  item: TechnicianOrderItem
  photos: PurchasePhoto[]
  orderId: string
  deleteDecision: PurchaseDeleteDecision
  onEdit: () => void
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lightboxPhotos: LightboxPhoto[] = photos.map((p) => ({
    id: p.id,
    label: `${item.name} — parça fotoğrafı`,
    note: p.note,
    fileUrl: p.src,
  }))

  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex gap-2.5">
        {photos.length > 0 ? (
          <div className="w-12 shrink-0">
            <PhotoThumbnail
              src={photos[0].src}
              label={`${item.name} — parça fotoğrafı`}
              onOpen={() => setLightboxIndex(0)}
            />
          </div>
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary-strong">
            <Package className="size-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words text-sm font-medium text-foreground">
              {item.name}
              {item.quantity !== 1 && (
                <span className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground">×{item.quantity}</span>
              )}
            </p>
            {item.purchasePriceKurus != null && (
              <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                {formatTRY(item.purchasePriceKurus)}
              </p>
            )}
          </div>

          {(item.sku || item.brand) && (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {item.sku && <span className="font-mono">{item.sku}</span>}
              {item.brand && <>{item.sku ? " · " : ""}{item.brand}</>}
            </p>
          )}

          {photos.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {photos.slice(1).map((p, i) => (
                <div key={p.id} className="w-12">
                  <PhotoThumbnail
                    src={p.src}
                    label={`${item.name} — parça fotoğrafı`}
                    onOpen={() => setLightboxIndex(i + 1)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Store className="size-3 shrink-0" />
          <span className="truncate">{item.supplierName || "Tedarikçi belirtilmedi"}</span>
        </span>
        {item.purchasedAt && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3 shrink-0" />
            {formatTrDate(item.purchasedAt)}
          </span>
        )}
        {item.tecdocArticleId != null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-strong">
            Katalog parçası
          </span>
        )}

        {deleteDecision.allowed ? (
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onEdit}
              aria-label={`${item.name} — dışarıdan alınan parçayı düzenle`}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
            </Button>
            <PurchaseDeleteButton item={item} orderId={orderId} />
          </div>
        ) : null}
      </div>

      <PhotoLightbox
        photos={lightboxPhotos}
        index={lightboxIndex ?? 0}
        onIndexChange={setLightboxIndex}
        open={lightboxIndex !== null}
        onOpenChange={(next) => { if (!next) setLightboxIndex(null) }}
      />
    </div>
  )
}

/**
 * Dış işçilik kartı — type=external_labor kalemi. Stok/katalog alanları yok,
 * yerine "nerede yaptırıldı" bilgisi ve kalem notu durur. Sil butonu yalnız
 * `deletable` izni açıksa görünür.
 */
function ExternalLaborCard({
  item, orderId, deletable, editable, onEdit,
}: {
  item: TechnicianOrderItem
  orderId: string
  deletable: boolean
  editable: boolean
  onEdit: () => void
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Usta dışarıya ödediğini görür, ofisin koyduğu satış fiyatını değil (#749).
  const paidKurus = externalLaborPaidKurus(item)

  async function confirmDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/items?id=${item.id}&orderId=${orderId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "Silinemedi")
        return
      }
      setConfirmOpen(false)
      toast.success("Dış işçilik kalemi kaldırıldı")
      router.refresh()
    } catch {
      toast.error("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-md border border-border p-2.5">
        <div className="flex gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning-strong">
            <Wrench className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="break-words text-sm font-medium text-foreground">{item.name}</p>
              {paidKurus != null && (
                <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                  {formatTRY(paidKurus * item.quantity)}
                </p>
              )}
            </div>
          </div>
        </div>
        {item.note && <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.note}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2">
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <Store className="size-3 shrink-0" />
            <span className="truncate">{item.supplierName || "Tedarikçi belirtilmedi"}</span>
          </span>
          {(item.purchasedAt || item.createdAt) && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="size-3 shrink-0" />
              {formatTrDate(item.purchasedAt ?? item.createdAt)}
            </span>
          )}
          {(editable || deletable) && (
            <div className="ml-auto flex items-center gap-1">
              {editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  aria-label={`${item.name} — dış işçilik kaydını düzenle`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </Button>
              )}
              {deletable && (
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="icon"
                  onClick={() => setConfirmOpen(true)}
                  aria-label={`${item.name} — dış işçilik kaydını sil`}
                  className="shrink-0 text-muted-foreground"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!busy) setConfirmOpen(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dış işçilik kaydı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{item.name}&quot; dış işçilik kalemi araç kabulünden kaldırılacak: tutarı toplamdan
              düşecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmDelete}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Dış alım kaydını iş emrinden komple kaldırır (BAK-83). Onay metni bunun bir
 * "listeden gizleme" değil, iş emri kaleminin silinmesi olduğunu açıkça söyler.
 */
function PurchaseDeleteButton({ item, orderId }: { item: TechnicianOrderItem; orderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirmDelete() {
    setBusy(true)
    try {
      const res = await removePurchaseItemAction(item.id, orderId)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      setOpen(false)
      toast.success("Parça araç kabulünden kaldırıldı")
      router.refresh()
    } catch {
      toast.error("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive-ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={`${item.name} — dışarıdan alınan parçayı sil`}
        className="text-muted-foreground"
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parça kaydı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{item.name}&quot; dışarıdan alınan parça kaydı araç kabulünden de kaldırılacak:
              tutarı toplamdan düşecek ve varsa parça kutusu fotoğrafı silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmDelete}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
