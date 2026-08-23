"use client"

import { useState } from "react"
import Image from "next/image"
import { Camera } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"
import { PHOTO_TYPES } from "@/lib/constants"
import { resolvePhotoSrc } from "@/lib/photos/photo-src"
import { formatDate } from "@/lib/utils-client"

export type VehicleHistoryPhoto = {
  id: string
  type: string
  label: string
  fileUrl: string | null
  createdAt: string
}

export function VehiclePhotoGrid({ photos }: { photos: VehicleHistoryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const viewable = photos.filter((photo) => photo.fileUrl)
  const lightboxPhotos: LightboxPhoto[] = viewable.map((photo) => {
    const type = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]
    return {
      id: photo.id,
      label: type?.label || photo.label || photo.type,
      note: formatDate(photo.createdAt),
      fileUrl: resolvePhotoSrc(photo),
    }
  })

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => {
          const type = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]
          const src = resolvePhotoSrc(photo)
          const label = type?.label || photo.label || photo.type
          return (
            <Button
              key={photo.id}
              type="button"
              variant="outline"
              disabled={!src}
              aria-label={src ? `${label} — büyüt` : label}
              onClick={() => {
                const next = viewable.findIndex((item) => item.id === photo.id)
                if (next >= 0) setOpenIndex(next)
              }}
              className="h-auto w-full flex-col items-stretch overflow-hidden p-0"
            >
              <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                {src ? (
                  <Image
                    src={src}
                    alt={label}
                    width={160}
                    height={120}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="size-6 text-muted-foreground/50" />
                )}
              </div>
              <div className="px-2 py-1.5 text-left">
                <p className="text-[11px] font-medium text-foreground truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(photo.createdAt)}</p>
              </div>
            </Button>
          )
        })}
      </div>
      <PhotoLightbox
        photos={lightboxPhotos}
        index={openIndex ?? 0}
        onIndexChange={setOpenIndex}
        open={openIndex !== null}
        onOpenChange={(next) => {
          if (!next) setOpenIndex(null)
        }}
      />
    </>
  )
}
