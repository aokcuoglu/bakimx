"use client"

import * as React from "react"
import { useState } from "react"
import { ImageOff, Plus } from "lucide-react"
import {
  PHOTO_PHASE_ORDER,
  PHOTO_PHASE_SHORT_LABELS,
  PHOTO_PHASES,
  type PhotoPhaseKey,
  type VehiclePhotoTypeKey,
} from "@/lib/constants"
import {
  buildPhotoPhaseMatrix,
  flattenTypeAcrossPhases,
  type PhaseMatrixPhoto,
  type PhaseMatrixRow,
} from "@/lib/photos/phase-matrix"
import { resolvePhotoSrc } from "@/lib/photos/photo-src"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PhotoDeleteButton } from "@/components/intake/photo-delete-button"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"

export type { PhaseMatrixPhoto }

/**
 * Tip satırı × Kabul / Onarım / Teslim hücreleri.
 * Boş hücre `onAdd(type, phase)` ile ekleme diyalogunu açar; dolu hücre
 * aynı tipin aşama karşılaştırmasını açar.
 */
export function PhotoPhaseMatrix({
  photos,
  canDelete = false,
  onDeleted,
  onAdd,
}: {
  photos: PhaseMatrixPhoto[]
  canDelete?: boolean
  onDeleted?: () => void
  onAdd?: (type: VehiclePhotoTypeKey, phase: PhotoPhaseKey) => void
}) {
  const rows = React.useMemo(() => buildPhotoPhaseMatrix(photos), [photos])
  const [compareRow, setCompareRow] = useState<PhaseMatrixRow | null>(null)
  const [focusPhase, setFocusPhase] = useState<PhotoPhaseKey | "all">("all")
  const [carouselOpen, setCarouselOpen] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [carouselPhotos, setCarouselPhotos] = useState<LightboxPhoto[]>([])

  function openCompare(row: PhaseMatrixRow, phase?: PhotoPhaseKey) {
    setCompareRow(row)
    setFocusPhase(phase ?? "all")
  }

  function openPhaseCarousel(row: PhaseMatrixRow, phase: PhotoPhaseKey, startId?: string) {
    const cell = row.cells.find((c) => c.phase === phase)
    const list = (cell?.photos ?? []).filter((p) => p.fileUrl)
    if (list.length === 0) return
    const lightbox: LightboxPhoto[] = list.map((p) => ({
      id: p.id,
      label: `${row.label} · ${PHOTO_PHASES[phase].label}`,
      note: p.note,
      fileUrl: resolvePhotoSrc(p),
    }))
    const idx = startId ? Math.max(0, list.findIndex((p) => p.id === startId)) : 0
    setCarouselPhotos(lightbox)
    setCarouselIndex(idx < 0 ? 0 : idx)
    setCarouselOpen(true)
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">Henüz araç fotoğrafı eklenmedi</p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[320px] space-y-2">
          <div
            className="grid gap-1.5 sm:gap-2"
            style={{ gridTemplateColumns: "minmax(4.5rem,5.5rem) repeat(3, minmax(0,1fr))" }}
          >
            <div />
            {PHOTO_PHASE_ORDER.map((phase) => (
              <div
                key={phase}
                className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center py-0.5"
              >
                {PHOTO_PHASE_SHORT_LABELS[phase]}
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <div
              key={row.type}
              className="grid gap-1.5 sm:gap-2 items-stretch"
              style={{ gridTemplateColumns: "minmax(4.5rem,5.5rem) repeat(3, minmax(0,1fr))" }}
            >
              <div className="flex flex-col justify-center gap-0.5 pr-1 min-w-0">
                <span className="text-xs sm:text-sm font-semibold truncate">{row.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {row.required ? "zorunlu" : "opsiyonel"}
                </span>
              </div>

              {row.cells.map((cell) => {
                const cover = cell.photos.find((p) => p.fileUrl) ?? cell.photos[0]
                if (!cover) {
                  return (
                    <EmptyPhaseCell
                      key={cell.phase}
                      phase={cell.phase}
                      disabled={!onAdd}
                      onAdd={() => onAdd?.(row.type, cell.phase)}
                    />
                  )
                }
                return (
                  <FilledPhaseCell
                    key={cell.phase}
                    phase={cell.phase}
                    photo={cover}
                    count={cell.photos.length}
                    typeLabel={row.label}
                    onOpen={() => openCompare(row, cell.phase)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <PhaseCompareDialog
        row={compareRow}
        focusPhase={focusPhase}
        onFocusPhaseChange={setFocusPhase}
        open={compareRow !== null}
        onOpenChange={(o) => {
          if (!o) setCompareRow(null)
        }}
        onOpenCarousel={(phase, photoId) => {
          if (!compareRow) return
          openPhaseCarousel(compareRow, phase, photoId)
        }}
        canDelete={canDelete}
        onDeleted={onDeleted}
        onAdd={
          onAdd && compareRow
            ? (phase) => {
                const type = compareRow.type
                setCompareRow(null)
                onAdd(type, phase)
              }
            : undefined
        }
      />

      <PhotoLightbox
        photos={carouselPhotos}
        index={carouselIndex}
        onIndexChange={setCarouselIndex}
        open={carouselOpen}
        onOpenChange={setCarouselOpen}
      />
    </>
  )
}

function EmptyPhaseCell({
  phase,
  disabled,
  onAdd,
}: {
  phase: PhotoPhaseKey
  disabled?: boolean
  onAdd: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onAdd}
      aria-label={`${PHOTO_PHASE_SHORT_LABELS[phase]} fotoğrafı ekle`}
      className="h-auto aspect-[4/3] w-full flex-col gap-1 border-dashed text-muted-foreground hover:text-foreground"
    >
      <Plus className="size-4" />
      <span className="text-[10px] font-semibold">Ekle</span>
    </Button>
  )
}

function FilledPhaseCell({
  phase,
  photo,
  count,
  typeLabel,
  onOpen,
}: {
  phase: PhotoPhaseKey
  photo: PhaseMatrixPhoto
  count: number
  typeLabel: string
  onOpen: () => void
}) {
  const phaseTone =
    phase === "intake"
      ? "bg-primary text-primary-foreground"
      : phase === "repair_progress"
        ? "bg-warning text-warning-foreground"
        : "bg-success text-success-foreground"

  // Sil butonu bilerek hücrede yok: dar mobil hücrede overlay tıklamayı yutuyor.
  // Silme, aşama karşılaştırma diyaloğunda (veya lightbox) yapılır.
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative block w-full overflow-hidden rounded-lg border bg-card text-left touch-manipulation hover:border-primary/40"
      aria-label={`${typeLabel} · ${PHOTO_PHASE_SHORT_LABELS[phase]} — karşılaştır`}
    >
      <div className="relative aspect-[4/3] bg-muted">
        {photo.fileUrl ? (
          <MatrixThumb photoId={photo.id} fileUrl={photo.fileUrl} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageOff className="size-5 text-muted-foreground" />
          </div>
        )}
        <span
          className={cn(
            "absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold",
            phaseTone
          )}
        >
          {PHOTO_PHASE_SHORT_LABELS[phase]}
        </span>
        {count > 1 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-full border bg-background/95 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
            {count}
          </span>
        )}
      </div>
    </button>
  )
}

function MatrixThumb({ photoId, fileUrl }: { photoId: string; fileUrl: string }) {
  const src = resolvePhotoSrc({ id: photoId, fileUrl })
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ImageOff className="size-5 text-muted-foreground" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated /api/photos proxy; next/image not wired for session blobs
    <img
      src={src}
      alt=""
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

function PhaseCompareDialog({
  row,
  focusPhase,
  onFocusPhaseChange,
  open,
  onOpenChange,
  onOpenCarousel,
  canDelete,
  onDeleted,
  onAdd,
}: {
  row: PhaseMatrixRow | null
  focusPhase: PhotoPhaseKey | "all"
  onFocusPhaseChange: (p: PhotoPhaseKey | "all") => void
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenCarousel: (phase: PhotoPhaseKey, photoId?: string) => void
  canDelete?: boolean
  onDeleted?: () => void
  onAdd?: (phase: PhotoPhaseKey) => void
}) {
  if (!row) return null

  const phasesToShow: PhotoPhaseKey[] =
    focusPhase === "all" ? [...PHOTO_PHASE_ORDER] : [focusPhase]

  const flatCount = flattenTypeAcrossPhases(row).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {row.label} · aşama karşılaştırması
          </DialogTitle>
          <DialogDescription>
            {flatCount} kare · Kabul → Onarım → Teslim ilişkisi
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={focusPhase === "all" ? "default" : "outline"}
            onClick={() => onFocusPhaseChange("all")}
          >
            Üçlü karşılaştır
          </Button>
          {PHOTO_PHASE_ORDER.map((phase) => (
            <Button
              key={phase}
              type="button"
              size="sm"
              variant={focusPhase === phase ? "default" : "outline"}
              onClick={() => onFocusPhaseChange(phase)}
            >
              {PHOTO_PHASE_SHORT_LABELS[phase]}
            </Button>
          ))}
        </div>

        <div
          className={cn(
            "grid gap-3",
            phasesToShow.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"
          )}
        >
          {phasesToShow.map((phase) => {
            const cell = row.cells.find((c) => c.phase === phase)!
            const cover = cell.photos.find((p) => p.fileUrl) ?? cell.photos[0]
            return (
              <div key={phase} className="space-y-2 rounded-lg border p-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {PHOTO_PHASES[phase].label}
                  {cell.photos.length > 1 ? ` · ${cell.photos.length}` : ""}
                </p>
                {cover?.fileUrl ? (
                  <div className="relative">
                    {canDelete ? (
                      <PhotoDeleteButton
                        photoId={cover.id}
                        photoLabel={`${row.label} · ${PHOTO_PHASE_SHORT_LABELS[phase]}`}
                        onDeleted={() => {
                          onOpenChange(false)
                          onDeleted?.()
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      className="relative block w-full overflow-hidden rounded-md aspect-[4/3] bg-muted touch-manipulation"
                      onClick={() => onOpenCarousel(phase, cover.id)}
                      aria-label={`${row.label} · ${PHOTO_PHASES[phase].label} büyüt`}
                    >
                      <MatrixThumb photoId={cover.id} fileUrl={cover.fileUrl} />
                    </button>
                  </div>
                ) : cover ? (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed bg-muted/40">
                    <span className="text-xs text-muted-foreground">Dosya yok</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!onAdd}
                    onClick={() => onAdd?.(phase)}
                    className="h-auto w-full aspect-[4/3] flex-col gap-1 border-dashed"
                  >
                    <Plus className="size-4" />
                    <span className="text-xs">Bu aşamaya ekle</span>
                  </Button>
                )}
                {cover?.note ? (
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap break-words">
                    {cover.note}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>

        <DialogClose asChild>
          <Button type="button" variant="outline" className="w-full sm:w-auto">
            Kapat
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
