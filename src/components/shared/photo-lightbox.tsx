"use client"

import * as React from "react"
import { ImageOff, X } from "lucide-react"

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

/**
 * Sayfa ortasında açılan fotoğraf carousel'i — tam ekran değil.
 * Kaydırma (Embla), ok tuşları, küçük resim şeridi ve tıklayınca zoom.
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
        className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex flex-row items-center gap-2 space-y-0 border-b px-3 py-2 sm:px-4">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">
            {current?.label || "Fotoğraf"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fotoğraf {safeIndex + 1} / {count}. Kaydırarak gezinin; görsele dokununca yakınlaşır.
          </DialogDescription>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {safeIndex + 1} / {count}
          </span>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Kapat">
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
          className="min-h-0 w-full"
        >
          <div className="relative bg-muted">
            <CarouselContent className="-ml-0">
              {photos.map((photo) => (
                <CarouselItem key={photo.id} className="pl-0">
                  <PhotoSlide
                    photo={photo}
                    token={token}
                    zoomed={zoomed && current?.id === photo.id}
                    onToggleZoom={() => setZoomed((value) => !value)}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            {count > 1 && !zoomed ? (
              <>
                <CarouselPrevious
                  size="icon"
                  className="left-2 bg-background/90"
                  aria-label="Önceki fotoğraf"
                />
                <CarouselNext
                  size="icon"
                  className="right-2 bg-background/90"
                  aria-label="Sonraki fotoğraf"
                />
              </>
            ) : null}
          </div>
        </Carousel>

        {current?.note ? (
          <p className="border-t px-4 py-2 text-sm text-muted-foreground whitespace-pre-wrap break-words">
            {current.note}
          </p>
        ) : null}

        {count > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-t px-3 py-2">
            {photos.map((photo, i) => {
              const thumbSrc = resolveSrc(photo, token)
              const selected = i === safeIndex
              return (
                <Button
                  key={photo.id}
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label={photo.label || `Fotoğraf ${i + 1}`}
                  aria-current={selected ? "true" : undefined}
                  className={cn("shrink-0 overflow-hidden p-0", selected && "ring-2 ring-ring")}
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
                    <ImageOff className="size-4 text-muted-foreground" />
                  )}
                </Button>
              )
            })}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function PhotoSlide({
  photo,
  token,
  zoomed,
  onToggleZoom,
}: {
  photo: LightboxPhoto
  token?: string
  zoomed: boolean
  onToggleZoom: () => void
}) {
  const src = resolveSrc(photo, token)

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center bg-muted",
        zoomed && "max-h-[min(58dvh,28rem)] overflow-auto sm:max-h-[min(64dvh,34rem)]"
      )}
    >
      {src ? (
        <Button
          type="button"
          variant="ghost"
          aria-pressed={zoomed}
          aria-label={zoomed ? "Uzaklaştır" : "Yakınlaştır"}
          onClick={onToggleZoom}
          className="h-auto max-h-[min(58dvh,28rem)] w-full rounded-none p-0 hover:bg-transparent sm:max-h-[min(64dvh,34rem)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={photo.label ?? "Fotoğraf"}
            draggable={false}
            className={cn(
              "max-h-[min(58dvh,28rem)] w-full object-contain transition-transform duration-200 sm:max-h-[min(64dvh,34rem)]",
              zoomed ? "max-h-none w-[180%] max-w-none cursor-zoom-out" : "cursor-zoom-in"
            )}
          />
        </Button>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-1 p-4 text-muted-foreground">
          <ImageOff className="size-8" />
          <span className="text-xs">Dosya yok</span>
        </div>
      )}
    </div>
  )
}
