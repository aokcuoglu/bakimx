"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ImageOff, Loader2 } from "lucide-react"
import { PHOTO_TYPES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"
import { PhotoDeleteButton } from "@/components/intake/photo-delete-button"
import { resolvePhotoSrc } from "@/lib/photos/photo-src"

export type GalleryPhoto = {
  id: string
  type: string
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  note: string | null
}

/**
 * Tıklanabilir fotoğraf grid'i — kartlardan birine dokununca aynı grup içinde
 * gezinilebilen modal carousel (`PhotoLightbox`) açılır. Dosyası olmayan
 * kayıtlar tıklanamaz. Hasar notu hem kartta hem lightbox'ta gösterilir.
 *
 * `canDelete` verildiğinde her kartın köşesinde sil butonu çıkar (yanlış çekilen
 * kareyi kaldırmak için); silme sunucuda soft'tur, çağıran `onDeleted` ile
 * kendi tazelemesini yapar.
 */
export function PhotoGalleryGrid({
  photos,
  gridClassName = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
  canDelete = false,
  onDeleted,
}: {
  photos: GalleryPhoto[]
  gridClassName?: string
  canDelete?: boolean
  onDeleted?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  // Yalnızca dosyası olan (görüntülenebilir) fotoğraflar lightbox'a girer.
  const viewable = React.useMemo(() => photos.filter((p) => p.fileUrl), [photos])
  const lightboxPhotos: LightboxPhoto[] = React.useMemo(
    () =>
      viewable.map((p) => ({
        id: p.id,
        label: PHOTO_TYPES[p.type as keyof typeof PHOTO_TYPES]?.label || p.type,
        note: p.note,
        fileUrl: resolvePhotoSrc(p),
      })),
    [viewable]
  )

  function openAt(photo: GalleryPhoto) {
    const i = viewable.findIndex((p) => p.id === photo.id)
    if (i < 0) return
    setIndex(i)
    setOpen(true)
  }

  return (
    <>
      <div className={gridClassName}>
        {photos.map((photo) => (
          <PhotoGalleryCard
            key={photo.id}
            photo={photo}
            onOpen={photo.fileUrl ? () => openAt(photo) : undefined}
            canDelete={canDelete}
            onDeleted={onDeleted}
          />
        ))}
      </div>
      <PhotoLightbox
        photos={lightboxPhotos}
        index={index}
        onIndexChange={setIndex}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

function PhotoGalleryCard({
  photo,
  onOpen,
  canDelete,
  onDeleted,
}: {
  photo: GalleryPhoto
  onOpen?: () => void
  canDelete?: boolean
  onDeleted?: () => void
}) {
  const typeLabel = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.type
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Fotoğraf karosu `variant="secondary" size="tile"` düğmesidir (#889); dosyası
  // olmayan yer tutucu aynı ölçü ve tonda.
  const frame = "aspect-square w-full"

  const metaLine = [photo.sizeBytes != null ? formatSize(photo.sizeBytes) : null, photo.fileName]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="min-w-0 space-y-1">
      <div className="relative">
        {photo.fileUrl && onOpen ? (
          <Button
            type="button"
            variant="secondary"
            size="tile"
            onClick={onOpen}
            aria-label={`${typeLabel} fotoğrafını büyüt`}
            className={cn(frame, "hover:ring-2 hover:ring-ring")}
          >
            <PhotoThumbnail photoId={photo.id} fileUrl={photo.fileUrl} />
          </Button>
        ) : (
          <div className={cn(frame, "flex items-center justify-center overflow-hidden rounded-md bg-secondary")}>
            <div className="text-center p-2">
              <ImageOff className="size-6 text-muted-foreground/30 mx-auto mb-1" />
              <span className="text-xs text-muted-foreground">Dosya yok</span>
            </div>
          </div>
        )}
        {canDelete && (
          <PhotoDeleteButton photoId={photo.id} photoLabel={typeLabel} onDeleted={onDeleted} />
        )}
      </div>
      <div className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium truncate">{typeLabel}</span>
        {photo.note && (
          <p className="text-xs text-foreground whitespace-pre-wrap break-words line-clamp-2">{photo.note}</p>
        )}
        {metaLine ? <p className="text-xs text-muted-foreground truncate">{metaLine}</p> : null}
      </div>
    </div>
  )
}

function PhotoThumbnail({ photoId, fileUrl }: { photoId: string; fileUrl: string }) {
  const [src, setSrc] = useState<string | null>(() =>
    fileUrl.startsWith("data:") ? fileUrl : null
  )
  const [loading, setLoading] = useState(() => !fileUrl.startsWith("data:"))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (fileUrl.startsWith("data:")) return

    let cancelled = false
    fetch(`/api/photos?id=${photoId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.blob()
      })
      .then((blob) => {
        if (!cancelled) {
          setSrc(URL.createObjectURL(blob))
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [photoId, fileUrl])

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Loader2 className="size-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (failed || !src) {
    return (
      <div className="text-center p-2">
        <ImageOff className="size-6 text-muted-foreground/30 mx-auto mb-1" />
        <span className="text-xs text-muted-foreground">Yüklenemedi</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Fotoğraf"
      className="w-full h-full object-cover"
    />
  )
}
