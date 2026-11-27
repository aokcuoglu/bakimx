"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Camera, ImageOff, Loader2, Phone, StickyNote, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { bpsToPercent } from "@/lib/money"
import { formatTrDateTime } from "@/lib/format-date"
import { resolvePhotoSrc } from "@/lib/photos/photo-src"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"
import { PhotoDeleteButton } from "@/components/intake/photo-delete-button"
import { Button } from "@/components/ui/button"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { deleteInternalNoteAction } from "@/app/(app)/technician/actions"

export type WorkCustomer = {
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
  email: string | null
}

export type WorkDamageMark = { id: string; zone: string; damageType: string; severity: string; note: string | null }

export type WorkInternalNote = { id: string; content: string; isPinned: boolean; createdAt: string }

export type WorkTotals = {
  discountAmount: number
  taxAmount: number
  grandTotal: number
}

export function CustomerBlock({ customer }: { customer: WorkCustomer }) {
  const name = customer.type === "corporate"
    ? customer.companyName || "Kurumsal"
    : customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Müşteri"

  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-foreground">{name}</p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Phone className="size-3.5" />
        <a href={`tel:${customer.phone}`} className="text-primary hover:underline">{customer.phone}</a>
      </p>
      {customer.email && <p className="text-muted-foreground">{customer.email}</p>}
    </div>
  )
}

export function DamageMarks({ marks }: { marks: WorkDamageMark[] }) {
  if (marks.length === 0) return null
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-foreground">Mevcut Hasarlar</h3>
      {marks.map((mark) => (
        <Item key={mark.id} variant="muted" size="sm" className="bg-destructive/10 text-destructive-strong">
          <ItemContent>
            <ItemTitle>{mark.zone} · {mark.damageType}</ItemTitle>
            <ItemDescription>
              {mark.severity}
              {mark.note ? ` · ${mark.note}` : ""}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </div>
  )
}

export function OrderTotals({ totals, taxRate }: { totals: WorkTotals; taxRate: number | null }) {
  return (
    <div className="mt-3 space-y-1 border-t border-border pt-3">
      {totals.discountAmount > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>İndirim</span><span>-{formatTRY(totals.discountAmount)}</span></div>}
      {totals.taxAmount > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>KDV (%{bpsToPercent(taxRate ?? 0)})</span><span>{formatTRY(totals.taxAmount)}</span></div>}
      <div className="flex justify-between text-sm font-semibold text-foreground"><span>Toplam</span><span>{formatTRY(totals.grandTotal)}</span></div>
    </div>
  )
}

/**
 * Faz bazlı fotoğraf ızgarası. Kaynak `fileUrl` değil `resolvePhotoSrc` ile
 * belirlenir (depo referansı doğrudan açılamaz), dokununca modal carousel
 * (`PhotoLightbox`) açılır. `canDelete` verildiğinde her karenin köşesinde sil
 * butonu çıkar (silme sunucuda soft'tur).
 */
export function PhotoSection({
  label,
  photos,
  canDelete,
  onDeleted,
}: {
  label: string
  photos: { id: string; fileUrl: string | null; label: string; note: string | null }[]
  canDelete?: boolean
  onDeleted?: () => void
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Dosyası olmayan kayıtlar açılamaz; lightbox yalnızca görüntülenebilirleri gezer.
  const viewable = photos.filter((p) => p.fileUrl)
  const lightboxPhotos: LightboxPhoto[] = viewable.map((p) => ({
    id: p.id,
    label: p.label,
    note: p.note,
    fileUrl: resolvePhotoSrc(p),
  }))

  if (photos.length === 0) return null

  return (
    <div className="mb-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label} ({photos.length})</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => {
          const src = resolvePhotoSrc(p)
          return (
            <div key={p.id} className="relative">
              {canDelete && (
                <PhotoDeleteButton photoId={p.id} photoLabel={p.label} onDeleted={onDeleted} />
              )}
              {src ? (
                <PhotoThumbnail
                  src={src}
                  label={p.label}
                  onOpen={() => setLightboxIndex(viewable.findIndex((v) => v.id === p.id))}
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                  <Camera className="size-5" />
                </div>
              )}
            </div>
          )
        })}
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

export function PhotoThumbnail({ src, label, onOpen }: { src: string; label: string; onOpen: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  // Önbellekten gelen görsel, React olay dinleyicileri bağlanmadan tamamlanabilir;
  // o durumda `onLoad` HİÇ tetiklenmez. Bu yüzden (a) mount'tan sonra `complete`
  // durumunu elle ölç, (b) görseli spinner'ın ÜSTÜNE koy ve yalnız gerçek hatada
  // gizle — böylece kaçan bir olay fotoğrafı görünmez yapamaz.
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    let frame = 0
    const settle = () => {
      const node = imgRef.current
      if (!node) return
      if (node.complete) {
        setState(node.naturalWidth > 0 ? "ready" : "failed")
        return
      }
      frame = requestAnimationFrame(settle)
    }
    settle()
    return () => cancelAnimationFrame(frame)
  }, [src])

  return (
    <Button
      type="button"
      variant="secondary"
      size="tile"
      onClick={onOpen}
      disabled={state === "failed"}
      aria-label={`${label} — büyüt`}
      className="relative aspect-square w-full border border-border"
    >
      {state !== "ready" && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground">
          {state === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <ImageOff className="size-4" />
              <span className="text-[10px] leading-none">Yüklenemedi</span>
            </>
          )}
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={label}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        className={cn(
          "relative h-full w-full object-cover transition-transform active:scale-95",
          state === "failed" && "opacity-0"
        )}
      />
    </Button>
  )
}

export function InternalNotesSection({ notes, locked }: { notes: WorkInternalNote[]; locked: boolean }) {
  const [, startTransition] = useTransition()

  if (notes.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">İç Notlar</h3>
      {notes.map((note) => (
        <div key={note.id} className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/10 px-3 py-2">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-warning-strong" />
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{formatTrDateTime(note.createdAt)}</p>
          </div>
          {!locked && (
            <Button
              type="button"
              variant="destructive-ghost"
              size="icon"
              aria-label="İç notu sil"
              onClick={() => {
                startTransition(async () => {
                  await deleteInternalNoteAction(note.id)
                })
              }}
              className="text-warning-strong"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
