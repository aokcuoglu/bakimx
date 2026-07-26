"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { ImageOff, Loader2 } from "lucide-react"
import { PHOTO_TYPES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"

export type GalleryPhoto = {
  id: string
  type: string
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  note: string | null
}

function toSrc(photo: Pick<GalleryPhoto, "id" | "fileUrl">): string | null {
  if (!photo.fileUrl) return null
  return photo.fileUrl.startsWith("data:") ? photo.fileUrl : `/api/photos?id=${photo.id}`
}

/**
 * Tıklanabilir fotoğraf grid'i — kartlardan birine dokununca aynı grup içinde
 * gezinilebilen tam ekran lightbox (`PhotoLightbox`) açılır. Dosyası olmayan
 * kayıtlar tıklanamaz. Hasar notu hem kartta hem lightbox'ta gösterilir.
 */
export function PhotoGalleryGrid({
  photos,
  gridClassName = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5",
}: {
  photos: GalleryPhoto[]
  gridClassName?: string
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
        fileUrl: toSrc(p),
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

function PhotoGalleryCard({ photo, onOpen }: { photo: GalleryPhoto; onOpen?: () => void }) {
  const typeLabel = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.type
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden bg-white",
        onOpen && "cursor-pointer transition hover:border-primary/40 hover:shadow-sm"
      )}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onOpen()
              }
            }
          : undefined
      }
    >
      <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
        {photo.fileUrl ? (
          <PhotoThumbnail photoId={photo.id} fileUrl={photo.fileUrl} />
        ) : (
          <div className="text-center p-2">
            <ImageOff className="size-6 text-muted-foreground/30 mx-auto mb-1" />
            <span className="text-[11px] text-muted-foreground">Dosya yok</span>
          </div>
        )}
      </div>
      <div className="p-2 space-y-1">
        <span className="block text-xs font-medium truncate">{typeLabel}</span>
        {photo.note && (
          <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words line-clamp-2">{photo.note}</p>
        )}
        {photo.fileName && (
          <p className="text-[11px] text-muted-foreground truncate">{photo.fileName}</p>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {photo.sizeBytes != null && <span>{formatSize(photo.sizeBytes)}</span>}
          {photo.mimeType && (
            <span className="uppercase">{photo.mimeType.split("/")[1]}</span>
          )}
        </div>
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
        <Loader2 className="size-6 text-muted-foreground/40 animate-spin" />
      </div>
    )
  }

  if (failed || !src) {
    return (
      <div className="text-center p-2">
        <ImageOff className="size-6 text-muted-foreground/30 mx-auto mb-1" />
        <span className="text-[11px] text-muted-foreground">Yüklenemedi</span>
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
