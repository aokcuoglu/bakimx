"use client"

import { useState } from "react"
import { Camera, Car, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PhotoLightbox } from "@/components/shared/photo-lightbox"

/**
 * Kabul oluşunca "Ön" fotoğrafı olarak yüklenecek araç karesi. Kabul kaydı
 * henüz yokken çekildiği için bellekte tutulur; `requestId` yüklemeyi
 * idempotent yapar (aynı kare iki kez kaydedilmez).
 */
export type PendingVehiclePhoto = {
  file: File
  previewUrl: string
  requestId: string
  /** "scan": plaka ekranında çekilen kare, "manual": araç bilgileri kartından çekilen. */
  source: "scan" | "manual"
}

export function createPendingVehiclePhoto(file: File, source: PendingVehiclePhoto["source"]): PendingVehiclePhoto {
  return { file, previewUrl: URL.createObjectURL(file), requestId: crypto.randomUUID(), source }
}

/**
 * Araç bilgileri ekranındaki zorunlu fotoğraf kartı. Plaka ekranında çekilen
 * kare de burada küçük resim olarak görünür; dokununca büyür, beğenilmezse
 * "Tekrar çek" ile değiştirilir. Plaka elle girildiyse kart boş başlar. "Kamera" plaka ekranındaki
 * tarayıcının AYNISINI açar (`PlateScanner`: canlı kamera + "Dosyadan"); kartın
 * kendisi yalnız durumu gösterir, kamerayı sihirbaz yönetir.
 */
export function VehiclePhotoCapture({
  photo,
  onCapture,
  busy = false,
  invalid = false,
}: {
  photo: PendingVehiclePhoto | null
  /** Tarayıcıyı aç. */
  onCapture: () => void
  /** Kare hazırlanıyor (sıkıştırma). */
  busy?: boolean
  /** Devam'a fotoğrafsız basıldıysa kart vurgulanır. */
  invalid?: boolean
}) {
  const borderClass = invalid && !photo ? "border-destructive/40" : "border-primary/20"
  const [zoomOpen, setZoomOpen] = useState(false)

  return (
    <div className={`space-y-2 rounded-lg border bg-primary/5 p-3 ${borderClass}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Car className="size-4" /> {photo ? "Aracın fotoğrafı" : "Aracın fotoğrafını çekin *"}
      </div>

      {busy ? (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground-strong">
          <Loader2 className="size-4 animate-spin" /> Fotoğraf hazırlanıyor…
        </div>
      ) : photo ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-md">
            <Button
              type="button"
              variant="ghost"
              className="block h-auto w-full rounded-none p-0 md:h-auto"
              aria-label="Araç fotoğrafını büyüt"
              onClick={() => setZoomOpen(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- bellekteki blob önizlemesi */}
              <img src={photo.previewUrl} alt="Aracın önü" className="aspect-video w-full object-cover" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="absolute bottom-2 left-2 gap-1.5 shadow-sm"
              onClick={onCapture}
            >
              <RotateCcw className="size-4" /> Tekrar çek
            </Button>
          </div>
          <p className="text-xs text-muted-foreground-strong">Kabul kaydına “Ön” fotoğrafı olarak eklenecek.</p>
          <PhotoLightbox
            photos={[{ id: photo.requestId, label: "Aracın önü", fileUrl: photo.previewUrl }]}
            index={0}
            onIndexChange={() => {}}
            open={zoomOpen}
            onOpenChange={setZoomOpen}
          />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground-strong">
            Aracın önünü plaka görünecek şekilde çekin; kabul kaydına eklenir.
          </p>
          <Button type="button" variant="foreground" className="w-full gap-2" onClick={onCapture}>
            <Camera className="size-4" /> Kamera
          </Button>
        </>
      )}
    </div>
  )
}
