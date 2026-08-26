"use client"

import * as React from "react"
import { useState } from "react"
import { ImageOff, Plus } from "lucide-react"
import {
  PHOTO_PHASE_ORDER,
  PHOTO_PHASE_SHORT_LABELS,
  type PhotoPhaseKey,
  type VehiclePhotoTypeKey,
} from "@/lib/constants"
import {
  buildPhotoPhaseMatrix,
  phaseCoverSlides,
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

/** Etiket + 3 sabit kare (~88px = size-11'in 2×). */
const COLS = "auto repeat(3, 5.5rem)"
const CELL = "size-[5.5rem]"

/**
 * Tip satırı × Kabul / Onarım / Teslim — kare thumb matrisi.
 * Dolu hücre üçlü karşılaştırmayı açar; diyalogdaki kareye tıklayınca
 * zoom lightbox Kabul → Onarım → Teslim arasında gezinir.
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
  const [carouselOpen, setCarouselOpen] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [carouselPhotos, setCarouselPhotos] = useState<LightboxPhoto[]>([])

  /** Zoom: tek aşamadaki tüm kareler değil — üç aşamanın kapakları. */
  function openPhaseZoom(row: PhaseMatrixRow, startPhase: PhotoPhaseKey) {
    const covers = phaseCoverSlides(row)
    if (covers.length === 0) return
    const slides: LightboxPhoto[] = covers.map(({ phase, photo }) => ({
      id: photo.id,
      label: `${row.label} · ${PHOTO_PHASE_SHORT_LABELS[phase]}`,
      note: photo.note,
      fileUrl: resolvePhotoSrc(photo),
    }))
    const startIndex = Math.max(
      0,
      covers.findIndex((c) => c.phase === startPhase)
    )
    setCarouselPhotos(slides)
    setCarouselIndex(startIndex)
    setCarouselOpen(true)
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">Henüz araç fotoğrafı eklenmedi</p>
    )
  }

  return (
    <>
      <div className="w-fit max-w-full space-y-1.5">
        <div
          className="grid items-center gap-x-1.5 gap-y-0.5"
          style={{ gridTemplateColumns: COLS }}
        >
          <div />
          {PHOTO_PHASE_ORDER.map((phase) => (
            <div
              key={phase}
              className="text-[10px] font-medium text-muted-foreground text-center leading-none pb-0.5"
            >
              {PHOTO_PHASE_SHORT_LABELS[phase]}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.type}
              className="grid items-center gap-x-1.5"
              style={{ gridTemplateColumns: COLS }}
            >
              <div className="min-w-0 pr-1">
                <span className="block text-[11px] font-medium truncate leading-tight">{row.label}</span>
                {row.required ? (
                  <span className="block text-[9px] text-muted-foreground leading-tight">zorunlu</span>
                ) : null}
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
                    onOpen={() => setCompareRow(row)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <PhaseCompareDialog
        row={compareRow}
        open={compareRow !== null}
        onOpenChange={(o) => {
          if (!o) setCompareRow(null)
        }}
        onZoom={(phase) => {
          if (!compareRow) return
          openPhaseZoom(compareRow, phase)
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
      size="icon-sm"
      disabled={disabled}
      onClick={onAdd}
      aria-label={`${PHOTO_PHASE_SHORT_LABELS[phase]} fotoğrafı ekle`}
      className={cn(CELL, "rounded-md border-dashed text-muted-foreground hover:text-foreground")}
    >
      <Plus className="size-3.5" />
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
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        CELL,
        "relative shrink-0 overflow-hidden rounded-md border bg-muted text-left touch-manipulation hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={`${typeLabel} · ${PHOTO_PHASE_SHORT_LABELS[phase]} — üçlü karşılaştır`}
    >
      {photo.fileUrl ? (
        <MatrixThumb photoId={photo.id} fileUrl={photo.fileUrl} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <ImageOff className="size-3.5 text-muted-foreground" />
        </div>
      )}
      {count > 1 ? (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-background/90 px-1 text-[9px] font-semibold tabular-nums leading-none py-0.5 border">
          {count}
        </span>
      ) : null}
    </button>
  )
}

function MatrixThumb({ photoId, fileUrl }: { photoId: string; fileUrl: string }) {
  const src = resolvePhotoSrc({ id: photoId, fileUrl })
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ImageOff className="size-4 text-muted-foreground" />
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
  open,
  onOpenChange,
  onZoom,
  canDelete,
  onDeleted,
  onAdd,
}: {
  row: PhaseMatrixRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onZoom: (phase: PhotoPhaseKey) => void
  canDelete?: boolean
  onDeleted?: () => void
  onAdd?: (phase: PhotoPhaseKey) => void
}) {
  if (!row) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.label} · üçlü karşılaştır</DialogTitle>
          <DialogDescription>
            Kabul · Onarım · Teslim — bir kareye dokununca büyür.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {PHOTO_PHASE_ORDER.map((phase) => {
            const cell = row.cells.find((c) => c.phase === phase)!
            const cover = cell.photos.find((p) => p.fileUrl) ?? cell.photos[0]
            return (
              <div key={phase} className="min-w-0 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">
                  {PHOTO_PHASE_SHORT_LABELS[phase]}
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
                      className="relative block w-full overflow-hidden rounded-md aspect-square bg-muted touch-manipulation ring-offset-background hover:ring-2 hover:ring-ring"
                      onClick={() => onZoom(phase)}
                      aria-label={`${row.label} · ${PHOTO_PHASE_SHORT_LABELS[phase]} — büyüt`}
                    >
                      <MatrixThumb photoId={cover.id} fileUrl={cover.fileUrl} />
                    </button>
                  </div>
                ) : cover ? (
                  <div className="flex aspect-square items-center justify-center rounded-md border border-dashed bg-muted/40">
                    <span className="text-[10px] text-muted-foreground">Dosya yok</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!onAdd}
                    onClick={() => onAdd?.(phase)}
                    className={cn(
                      "h-auto w-full aspect-square flex-col gap-0.5 border-dashed text-muted-foreground"
                    )}
                  >
                    <Plus className="size-3.5" />
                    <span className="text-[10px]">Ekle</span>
                  </Button>
                )}
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
