"use client"

import { Camera, ImageOff, Loader2 } from "lucide-react"
import { PHOTO_TYPES } from "@/lib/constants"
import { useState, useEffect } from "react"

type GroupedPhoto = {
  id: string
  type: string
  label: string
  fileUrl: string | null
  phase: string
}

type PhotoPhaseGroup = {
  phase: string
  label: string
  photos: GroupedPhoto[]
}

type GroupedPhotoGalleryProps = {
  groups: PhotoPhaseGroup[]
  token?: string
  compact?: boolean
}

const PHASE_ICONS: Record<string, string> = {
  intake: "🚗",
  repair_progress: "🔧",
  delivery: "📦",
}

export function GroupedPhotoGallery({ groups, token, compact = false }: GroupedPhotoGalleryProps) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Camera className="size-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">Fotoğraf bulunmuyor</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.phase} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{PHASE_ICONS[group.phase] || "📷"}</span>
            <h4 className={`font-semibold ${compact ? "text-xs" : "text-sm"} text-muted-foreground uppercase tracking-wide`}>
              {group.label}
            </h4>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {group.photos.length}
            </span>
          </div>
          <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"} gap-2`}>
            {group.photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                token={token}
                compact={compact}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PhotoCard({
  photo,
  token,
  compact,
}: {
  photo: GroupedPhoto
  token?: string
  compact?: boolean
}) {
  const isDataUrl = photo.fileUrl?.startsWith("data:") ?? false
  const [src, setSrc] = useState<string | null>(() => isDataUrl ? photo.fileUrl! : null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(() => !isDataUrl && !!photo.id && !!token)

  useEffect(() => {
    if (isDataUrl || !photo.id || !token) return

    const imgSrc = `/s/${token}/photos/${photo.id}`
    const img = new window.Image()
    img.onload = () => {
      setSrc(imgSrc)
      setLoading(false)
    }
    img.onerror = () => {
      setFailed(true)
      setLoading(false)
    }
    img.src = imgSrc
  }, [photo, token, isDataUrl])

  const typeLabel = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.label

  if (loading) {
    return (
      <div className={`aspect-square bg-muted rounded-lg flex items-center justify-center ${compact ? "rounded" : "rounded-lg"}`}>
        <Loader2 className="size-4 text-muted-foreground/40 animate-spin" />
      </div>
    )
  }

  if (failed || !src) {
    return (
      <div className={`aspect-square bg-muted/50 rounded-lg flex items-center justify-center border border-muted ${compact ? "rounded" : "rounded-lg"}`}>
        <div className="text-center p-1">
          <ImageOff className={`${compact ? "size-3" : "size-4"} text-muted-foreground/30 mx-auto`} />
          <span className={`${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground mt-0.5 block truncate px-1`}>
            {typeLabel}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`aspect-square overflow-hidden bg-muted ${compact ? "rounded" : "rounded-lg"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={typeLabel}
        className="w-full h-full object-cover"
      />
    </div>
  )
}