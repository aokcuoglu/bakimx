"use client"

import * as React from "react"
import { ImageOff, X, ZoomIn, ZoomOut } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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

const MIN_SCALE = 1
const MAX_SCALE = 5
const TOGGLE_SCALE = 2.5
const DOUBLE_TAP_MS = 300

/**
 * Tam ekran, siyah zeminli fotoğraf galerisi.
 * Kaydırma (Embla), ok tuşları, küçük resim şeridi; görselde iki parmakla
 * yakınlaştırma, çift dokunma / tıklama, fare tekerleği ve sürükleyerek gezinme.
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
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1)
  const current = count === 0 ? undefined : photos[safeIndex]

  const [api, setApi] = React.useState<CarouselApi>()
  const [zoomed, setZoomed] = React.useState(false)
  // Başlıktaki düğmenin etkin slayta "yakınlaş / uzaklaş" demesi için sayaç.
  const [zoomCommand, setZoomCommand] = React.useState(0)
  const zoomedRef = React.useRef(false)
  React.useEffect(() => {
    zoomedRef.current = zoomed
  }, [zoomed])

  const onIndexChangeRef = React.useRef(onIndexChange)
  React.useEffect(() => {
    onIndexChangeRef.current = onIndexChange
  }, [onIndexChange])

  React.useEffect(() => {
    if (!api) return
    const onSelect = () => {
      setZoomed(false)
      const next = api.selectedScrollSnap()
      if (next !== index) onIndexChangeRef.current(next)
    }
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api, index])

  React.useEffect(() => {
    if (!api || !open) return
    if (api.selectedScrollSnap() !== safeIndex) api.scrollTo(safeIndex, true)
  }, [api, open, safeIndex])

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) setZoomed(false)
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const onOpenChangeRef = React.useRef(handleOpenChange)
  React.useEffect(() => {
    onOpenChangeRef.current = handleOpenChange
  }, [handleOpenChange])

  // Mobil "geri" hareketi sayfadan çıkmasın, ÖNCE fotoğrafı kapatsın.
  // Girdi eklenirken Next'in kendi geçmiş durumu (`window.history.state`)
  // korunur — üzerine yazmak App Router'ın gezinti durumunu bozar.
  React.useEffect(() => {
    if (!open) return
    window.history.pushState({ ...window.history.state, bakimxLightbox: true }, "")

    function onPop() {
      onOpenChangeRef.current(false)
    }
    window.addEventListener("popstate", onPop)

    return () => {
      window.removeEventListener("popstate", onPop)
      if (window.history.state?.bakimxLightbox) window.history.back()
    }
  }, [open])

  const visible = open && count > 0

  return (
    <Dialog open={visible} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black"
        className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-black p-0 text-white shadow-none ring-0 sm:max-w-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex shrink-0 flex-row items-center gap-2 space-y-0 border-0 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-4">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {current?.label || "Fotoğraf"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fotoğraf {safeIndex + 1} / {count}. Kaydırarak gezinin; iki parmakla ya da çift
            dokunarak yakınlaştırın.
          </DialogDescription>
          <span className="shrink-0 text-xs tabular-nums text-white">
            {safeIndex + 1} / {count}
          </span>
          <Button
            type="button"
            variant="on-photo-ghost"
            size="icon"
            aria-label={zoomed ? "Uzaklaştır" : "Yakınlaştır"}
            aria-pressed={zoomed}
            onClick={() => setZoomCommand((value) => value + 1)}
          >
            {zoomed ? <ZoomOut /> : <ZoomIn />}
          </Button>
          <DialogClose asChild>
            <Button
              type="button"
              variant="on-photo"
              size="icon"
              aria-label="Kapat"
            >
              <X />
            </Button>
          </DialogClose>
        </DialogHeader>

        <Carousel
          setApi={setApi}
          opts={{
            startIndex: safeIndex,
            watchDrag: () => !zoomedRef.current,
          }}
          className="relative min-h-0 w-full flex-1 [&>[data-slot=carousel-content]]:h-full"
        >
          <CarouselContent className="-ml-0 h-full">
            {photos.map((photo) => (
              <CarouselItem key={photo.id} className="h-full pl-0">
                <ZoomableSlide
                  photo={photo}
                  token={token}
                  active={current?.id === photo.id}
                  toggleSignal={zoomCommand}
                  onZoomChange={setZoomed}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {count > 1 && !zoomed ? (
            <>
              <CarouselPrevious
                size="icon"
                className="left-2 border-0 bg-black/60 text-white hover:bg-black/80 hover:text-white"
                aria-label="Önceki fotoğraf"
              />
              <CarouselNext
                size="icon"
                className="right-2 border-0 bg-black/60 text-white hover:bg-black/80 hover:text-white"
                aria-label="Sonraki fotoğraf"
              />
            </>
          ) : null}
        </Carousel>

        {current?.note ? (
          <p className="shrink-0 px-4 py-2 text-sm whitespace-pre-wrap break-words text-white">
            {current.note}
          </p>
        ) : null}

        {count > 1 ? (
          <div className="flex shrink-0 justify-center-safe gap-2 overflow-x-auto px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {photos.map((photo, i) => {
              const thumbSrc = resolveSrc(photo, token)
              const selected = i === safeIndex
              return (
                <Button
                  key={photo.id}
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label={photo.label || `Fotoğraf ${i + 1}`}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "shrink-0 overflow-hidden rounded-md p-0 ring-2 ring-transparent hover:bg-transparent",
                    selected ? "ring-white" : "brightness-50 hover:brightness-75"
                  )}
                  onClick={() => {
                    setZoomed(false)
                    onIndexChange(i)
                    api?.scrollTo(i)
                  }}
                >
                  {thumbSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbSrc} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageOff className="size-4 text-white" />
                  )}
                </Button>
              )
            })}
          </div>
        ) : (
          <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
        )}
      </DialogContent>
    </Dialog>
  )
}

type View = { scale: number; x: number; y: number }
const IDENTITY: View = { scale: 1, x: 0, y: 0 }

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Tek fotoğraf; transform tabanlı yakınlaştırma.
 * - iki parmak: pinch, tek parmak / fare (yakınken): sürükle
 * - çift dokunma / fare tıklaması: 1× ↔ 2.5× (dokunulan noktaya)
 * - fare tekerleği: imleç etrafında kademeli
 */
function ZoomableSlide({
  photo,
  token,
  active,
  toggleSignal,
  onZoomChange,
}: {
  photo: LightboxPhoto
  token?: string
  active: boolean
  toggleSignal: number
  onZoomChange: (zoomed: boolean) => void
}) {
  const src = resolveSrc(photo, token)
  const frameRef = React.useRef<HTMLDivElement>(null)
  const [view, setView] = React.useState<View>(IDENTITY)
  const viewRef = React.useRef(view)
  const [gesturing, setGesturing] = React.useState(false)

  const pointers = React.useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = React.useRef<{ dist: number; view: View; cx: number; cy: number } | null>(null)
  const panStart = React.useRef<{ px: number; py: number; view: View } | null>(null)
  const moved = React.useRef(false)
  const downAt = React.useRef<{ x: number; y: number } | null>(null)
  const lastTap = React.useRef(0)

  const onZoomChangeRef = React.useRef(onZoomChange)
  React.useEffect(() => {
    onZoomChangeRef.current = onZoomChange
  }, [onZoomChange])

  const apply = React.useCallback((next: View) => {
    const frame = frameRef.current
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE)
    let { x, y } = next
    if (scale <= MIN_SCALE) {
      x = 0
      y = 0
    } else if (frame) {
      // Görsel kadrajı terk etmesin: kaydırma, büyümenin taşırdığı payla sınırlı.
      const maxX = (frame.clientWidth * (scale - 1)) / 2
      const maxY = (frame.clientHeight * (scale - 1)) / 2
      x = clamp(x, -maxX, maxX)
      y = clamp(y, -maxY, maxY)
    }
    const result = { scale, x, y }
    viewRef.current = result
    setView(result)
    if (active) onZoomChangeRef.current(scale > MIN_SCALE)
  }, [active])

  /** Kadraj merkezine göre (px, py) noktasını sabit tutarak ölçek değiştir. */
  const zoomAt = React.useCallback(
    (targetScale: number, clientX: number, clientY: number, from: View = viewRef.current) => {
      const frame = frameRef.current
      if (!frame) return
      const rect = frame.getBoundingClientRect()
      const px = clientX - rect.left - rect.width / 2
      const py = clientY - rect.top - rect.height / 2
      const scale = clamp(targetScale, MIN_SCALE, MAX_SCALE)
      const ratio = scale / from.scale
      apply({ scale, x: px - (px - from.x) * ratio, y: py - (py - from.y) * ratio })
    },
    [apply]
  )

  const toggleAt = React.useCallback(
    (clientX: number, clientY: number) => {
      if (viewRef.current.scale > MIN_SCALE) apply(IDENTITY)
      else zoomAt(TOGGLE_SCALE, clientX, clientY)
    },
    [apply, zoomAt]
  )

  // Başka slayta geçilince bu slayt sıfırlanır (render sırasında durum ayarı).
  const [wasActive, setWasActive] = React.useState(active)
  if (wasActive !== active) {
    setWasActive(active)
    if (!active) setView(IDENTITY)
  }
  React.useEffect(() => {
    if (!active) viewRef.current = IDENTITY
  }, [active])

  // Başlıktaki yakınlaştır/uzaklaştır düğmesi.
  const lastSignal = React.useRef(toggleSignal)
  React.useEffect(() => {
    if (toggleSignal === lastSignal.current) return
    lastSignal.current = toggleSignal
    // Sinyal tüm slaytlara gider; yalnız görünen slayt tepki verir.
    if (!active) return
    const rect = frameRef.current?.getBoundingClientRect()
    if (rect) toggleAt(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }, [toggleSignal, toggleAt, active])

  // Tekerlek: React'in onWheel'i pasif olduğu için preventDefault yerel dinleyicide.
  React.useEffect(() => {
    const frame = frameRef.current
    if (!frame || !src) return
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const factor = Math.exp(-event.deltaY * 0.0015)
      zoomAt(viewRef.current.scale * factor, event.clientX, event.clientY)
    }
    frame.addEventListener("wheel", onWheel, { passive: false })
    return () => frame.removeEventListener("wheel", onWheel)
  }, [src, zoomAt])

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    moved.current = false
    downAt.current = { x: event.clientX, y: event.clientY }

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        view: viewRef.current,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      }
      panStart.current = null
      setGesturing(true)
    } else if (pointers.current.size === 1 && viewRef.current.scale > MIN_SCALE) {
      panStart.current = { px: event.clientX, py: event.clientY, view: viewRef.current }
      event.currentTarget.setPointerCapture(event.pointerId)
      setGesturing(true)
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    // Carousel kaydırması (yakın değilken) dokunma/tıklama sayılmasın.
    const start = downAt.current
    if (start && Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 6) {
      moved.current = true
    }

    const pinch = pinchStart.current
    if (pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      moved.current = true
      // Ölçek pinch başlangıcına göre; orta nokta kayması da kaydırmaya eklenir.
      const scaled = { ...pinch.view }
      const frame = frameRef.current
      if (!frame) return
      const rect = frame.getBoundingClientRect()
      const px = pinch.cx - rect.left - rect.width / 2
      const py = pinch.cy - rect.top - rect.height / 2
      const scale = clamp(pinch.view.scale * (dist / pinch.dist), MIN_SCALE, MAX_SCALE)
      const ratio = scale / pinch.view.scale
      scaled.scale = scale
      scaled.x = px - (px - pinch.view.x) * ratio + (cx - pinch.cx)
      scaled.y = py - (py - pinch.view.y) * ratio + (cy - pinch.cy)
      apply(scaled)
      return
    }

    const pan = panStart.current
    if (pan) {
      const dx = event.clientX - pan.px
      const dy = event.clientY - pan.py
      apply({ scale: pan.view.scale, x: pan.view.x + dx, y: pan.view.y + dy })
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const wasTracked = pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      panStart.current = null
      setGesturing(false)
    }
    if (!wasTracked || moved.current || event.type === "pointercancel") return

    if (event.pointerType === "mouse") {
      toggleAt(event.clientX, event.clientY)
      return
    }
    const now = event.timeStamp
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0
      toggleAt(event.clientX, event.clientY)
    } else {
      lastTap.current = now
    }
  }

  const zoomed = view.scale > MIN_SCALE

  return (
    <div
      ref={frameRef}
      className={cn(
        "relative flex size-full touch-none items-center justify-center overflow-hidden select-none",
        src && (zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")
      )}
      onPointerDown={src ? onPointerDown : undefined}
      onPointerMove={src ? onPointerMove : undefined}
      onPointerUp={src ? onPointerUp : undefined}
      onPointerCancel={src ? onPointerUp : undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={photo.label ?? "Fotoğraf"}
          draggable={false}
          className={cn(
            "pointer-events-none max-h-full max-w-full object-contain will-change-transform",
            !gesturing && "transition-transform duration-200 motion-reduce:transition-none"
          )}
          style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 p-4 text-white">
          <ImageOff className="size-8" />
          <span className="text-xs">Dosya yok</span>
        </div>
      )}
    </div>
  )
}
