"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

export type LightboxPhoto = {
  id: string
  label?: string
  note?: string | null
  fileUrl: string | null
}

function resolveSrc(photo: LightboxPhoto, token?: string): string | null {
  if (photo.fileUrl?.startsWith("data:")) return photo.fileUrl
  if (token && photo.id) return `/s/${token}/photos/${photo.id}`
  return photo.fileUrl ?? null
}

/**
 * Tam ekran fotoğraf görüntüleyici — mobil-öncelikli.
 * Yatay swipe (framer-motion) ile gezinme, çift-dokunuşla zoom (+ pan),
 * sayaç + başlık, safe-area'ya saygılı kontroller.
 *
 * Kontrollü: `open`, `index` ve `onIndexChange` parent'ta tutulur.
 */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  open,
  onOpenChange,
  token,
}: {
  photos: LightboxPhoto[]
  index: number
  onIndexChange: (next: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  token?: string
}) {
  const count = photos.length
  const [zoomed, setZoomed] = React.useState(false)

  const go = React.useCallback(
    (dir: 1 | -1) => {
      if (count < 2) return
      setZoomed(false)
      onIndexChange((index + dir + count) % count)
    },
    [count, index, onIndexChange]
  )

  // Body scroll kilidi + klavye gezintisi (yalnızca açıkken).
  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false)
      else if (e.key === "ArrowRight") go(1)
      else if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, go, onOpenChange])

  if (!open || count === 0) return null

  const current = photos[Math.min(index, count - 1)]
  const src = resolveSrc(current, token)

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
    >
      {/* Üst bar */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3 text-white safe-area-top"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium tabular-nums text-white/80">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          aria-label="Kapat"
          onClick={() => onOpenChange(false)}
          className="inline-flex size-12 items-center justify-center rounded-full text-white/90 hover:bg-white/10 touch-manipulation"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* Görüntü alanı */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Loader2 className="absolute size-8 animate-spin text-white/30" />
        {src && (
          <motion.img
            key={current.id}
            src={src}
            alt={current.label ?? ""}
            draggable={false}
            drag={zoomed ? true : "x"}
            dragConstraints={zoomed ? undefined : { left: 0, right: 0 }}
            dragElastic={zoomed ? 0.05 : 0.4}
            onDragEnd={(_e, info) => {
              if (zoomed) return
              if (info.offset.x < -80) go(1)
              else if (info.offset.x > 80) go(-1)
            }}
            onDoubleClick={() => setZoomed((z) => !z)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: zoomed ? 2.4 : 1 }}
            transition={{ opacity: { duration: 0.15 }, scale: { duration: 0.2 } }}
            className="relative max-h-full max-w-full object-contain select-none"
            style={{ touchAction: "none", cursor: zoomed ? "grab" : "auto" }}
          />
        )}

        {/* Prev / Next */}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Önceki"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/90 hover:bg-black/50 touch-manipulation"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Sonraki"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/90 hover:bg-black/50 touch-manipulation"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      {/* Başlık + not */}
      {(current.label || current.note) && (
        <div
          className="shrink-0 space-y-1 px-4 py-3 text-center safe-area-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          {current.label && <div className="text-sm text-white/80">{current.label}</div>}
          {current.note && (
            <div className="text-sm text-white whitespace-pre-wrap break-words">{current.note}</div>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
