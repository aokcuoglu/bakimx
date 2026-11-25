"use client"

import * as React from "react"
import { useState } from "react"
import { Camera, Check, ImageOff, Plus } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
 * Kabul / Onarım / Teslim seçicisi + seçili aşamanın açı kutucukları.
 * Boş kutu o açı ve aşama için ekleme diyaloğunu açar; dolu kutu üçlü
 * karşılaştırmayı açar, oradaki kareye tıklayınca zoom lightbox aşamalar
 * arasında gezinir. En sondaki "Fotoğraf ekle" kutusu serbest eklemedir.
 */
export function PhotoPhaseMatrix({
  photos,
  canDelete = false,
  onDeleted,
  onAdd,
  onAddOther,
  defaultPhase = "intake",
}: {
  photos: PhaseMatrixPhoto[]
  canDelete?: boolean
  onDeleted?: () => void
  onAdd?: (type: VehiclePhotoTypeKey, phase: PhotoPhaseKey) => void
  /** Serbest ekleme (tür seçilir); aşama seçili sekmeden gelir. */
  onAddOther?: (phase: PhotoPhaseKey) => void
  /** İş emrinin bulunduğu aşama; seçici bununla açılır. */
  defaultPhase?: PhotoPhaseKey
}) {
  const rows = React.useMemo(() => buildPhotoPhaseMatrix(photos), [photos])
  const [phase, setPhase] = useState<PhotoPhaseKey>(defaultPhase)
  const requiredRows = rows.filter((row) => row.required)
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

  return (
    <>
      <Tabs value={phase} onValueChange={(v) => setPhase(v as PhotoPhaseKey)} className="gap-3">
        <TabsList size="control" className="w-full sm:w-fit" aria-label="Fotoğraf aşaması">
          {PHOTO_PHASE_ORDER.map((key) => {
            const filled = requiredRows.filter((row) => cellOf(row, key).photos.length > 0).length
            const extra = rows.filter((row) => !row.required && cellOf(row, key).photos.length > 0).length
            return (
              <TabsTrigger key={key} value={key} className="sm:px-3">
                {PHOTO_PHASE_SHORT_LABELS[key]}
                <span className="tabular-nums text-xs text-muted-foreground">
                  {requiredRows.length ? `${filled}/${requiredRows.length}` : filled + extra}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {PHOTO_PHASE_ORDER.map((key) => (
          <TabsContent key={key} value={key} className="@container">
            <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
              {rows.map((row) => {
                const cell = cellOf(row, key)
                const cover = cell.photos.find((p) => p.fileUrl) ?? cell.photos[0]
                return (
                  <li key={row.type} className="min-w-0 space-y-1">
                    {cover ? (
                      <FilledTile
                        photo={cover}
                        label={`${row.label} · ${PHOTO_PHASE_SHORT_LABELS[key]}`}
                        onOpen={() => setCompareRow(row)}
                      />
                    ) : (
                      <EmptyTile
                        label={`${row.label} · ${PHOTO_PHASE_SHORT_LABELS[key]}`}
                        disabled={!onAdd}
                        onAdd={() => onAdd?.(row.type, key)}
                      />
                    )}
                    <TileCaption
                      label={row.label}
                      hint={cell.photos.length > 1 ? `${cell.photos.length} fotoğraf` : !cover && row.required ? "Zorunlu" : null}
                    />
                  </li>
                )
              })}
              {onAddOther ? (
                <li className="min-w-0 space-y-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="tile"
                    onClick={() => onAddOther(key)}
                    className={cn(TILE, "text-muted-foreground hover:text-foreground hover:ring-2 hover:ring-ring")}
                  >
                    <Plus className="size-4" />
                    <span className="text-xs font-medium">Fotoğraf ekle</span>
                  </Button>
                  <TileCaption label="Diğer" hint="Ruhsat, şase…" />
                </li>
              ) : null}
            </ul>
          </TabsContent>
        ))}
      </Tabs>

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

/**
 * Telefonda kare ve iki sütun; kap genişleyince 4:3 ve dört sütun. Çerçevesiz,
 * gri zeminli: `variant="secondary" size="tile"` (#889) — ölçü ve köşe düğmeden.
 */
const TILE = "aspect-square w-full @xl:aspect-[4/3]"

const cellOf = (row: PhaseMatrixRow, phase: PhotoPhaseKey) => row.cells.find((c) => c.phase === phase)!

function TileCaption({ label, hint }: { label: string; hint: string | null }) {
  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-sm font-medium">{label}</p>
      <p className="truncate text-xs text-muted-foreground">{hint ?? "\u00a0"}</p>
    </div>
  )
}

function EmptyTile({ label, disabled, onAdd }: { label: string; disabled?: boolean; onAdd: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="tile"
      disabled={disabled}
      onClick={onAdd}
      aria-label={`${label} fotoğrafı ekle`}
      className={cn(TILE, "text-muted-foreground hover:text-foreground hover:ring-2 hover:ring-ring")}
    >
      <Camera className="size-5" />
    </Button>
  )
}

function FilledTile({ photo, label, onOpen }: { photo: PhaseMatrixPhoto; label: string; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="tile"
      onClick={onOpen}
      className={cn(TILE, "relative hover:ring-2 hover:ring-ring")}
      aria-label={`${label} — aşamaları karşılaştır`}
    >
      {photo.fileUrl ? (
        <MatrixThumb photoId={photo.id} fileUrl={photo.fileUrl} />
      ) : (
        <ImageOff className="size-5 text-muted-foreground" />
      )}
      <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-success text-success-foreground shadow-sm">
        <Check className="size-3" strokeWidth={3} />
      </span>
    </Button>
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
                <p className="text-xs font-medium text-muted-foreground text-center">
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="tile"
                      className="relative w-full aspect-square hover:ring-2 hover:ring-ring"
                      onClick={() => onZoom(phase)}
                      aria-label={`${row.label} · ${PHOTO_PHASE_SHORT_LABELS[phase]} — büyüt`}
                    >
                      <MatrixThumb photoId={cover.id} fileUrl={cover.fileUrl} />
                    </Button>
                  </div>
                ) : cover ? (
                  <div className="flex aspect-square items-center justify-center rounded-md bg-secondary">
                    <span className="text-xs text-muted-foreground">Dosya yok</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="tile"
                    disabled={!onAdd}
                    onClick={() => onAdd?.(phase)}
                    className="w-full aspect-square gap-0.5 text-muted-foreground hover:text-foreground hover:ring-2 hover:ring-ring"
                  >
                    <Plus className="size-3.5" />
                    <span className="text-xs">Ekle</span>
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
