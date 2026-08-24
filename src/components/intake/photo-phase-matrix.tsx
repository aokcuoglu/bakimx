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

const COLS = "3.25rem repeat(3, minmax(0,1fr))"

/**
 * Tip satırı × Kabul / Onarım / Teslim — kompakt matris.
 * Dolu hücre üçlü karşılaştırmayı açar; diyalogdaki kareye tıklayınca zoom lightbox.
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

  function openZoom(row: PhaseMatrixRow, phase: PhotoPhaseKey, startId?: string) {
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
      <div className="space-y-1">
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

        <div className="space-y-1">
          {rows.map((row) => (
            <div
              key={row.type}
              className="grid items-center gap-x-1.5"
              style={{ gridTemplateColumns: COLS }}
            >
              <div className="min-w-0 pr-0.5">
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
        onZoom={(phase, photoId) => {
          if (!compareRow) return
          openZoom(compareRow, phase, photoId)
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
      className="h-11 w-full rounded-md border-dashed text-muted-foreground hover:text-foreground"
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
      className="relative h-11 w-full overflow-hidden rounded-md border bg-muted text-left touch-manipulation hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <ImageOff className="size-3.5 text-muted-foreground" />
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
  onZoom: (phase: PhotoPhaseKey, photoId?: string) => void
  canDelete?: boolean
  onDeleted?: () => void
  onAdd?: (phase: PhotoPhaseKey) => void
}) {
  if (!row) return null

  const flatCount = flattenTypeAcrossPhases(row).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.label} · üçlü karşılaştır</DialogTitle>
          <DialogDescription>
            {flatCount} kare · Kabul → Onarım → Teslim. Bir kareye dokununca büyür.
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
                      className="relative block w-full overflow-hidden rounded-md aspect-[4/3] bg-muted touch-manipulation ring-offset-background hover:ring-2 hover:ring-ring"
                      onClick={() => onZoom(phase, cover.id)}
                      aria-label={`${row.label} · ${PHOTO_PHASE_SHORT_LABELS[phase]} — büyüt`}
                    >
                      <MatrixThumb photoId={cover.id} fileUrl={cover.fileUrl} />
                    </button>
                  </div>
                ) : cover ? (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed bg-muted/40">
                    <span className="text-[10px] text-muted-foreground">Dosya yok</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!onAdd}
                    onClick={() => onAdd?.(phase)}
                    className={cn(
                      "h-auto w-full aspect-[4/3] flex-col gap-0.5 border-dashed text-muted-foreground"
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
