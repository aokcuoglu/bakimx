"use client"

import type { MouseEventHandler } from "react"
import { CarFront, Check } from "lucide-react"
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

/**
 * "Yalnız bu araca uyanlar" süzgeci (#755, durum görünürlüğü #760).
 *
 * Önceki hâlde açık düğme yalnız `bg-muted` alıyordu; listedeki her satır zaten
 * uyumluyken tıklamak görünür hiçbir şey değiştirmiyor, kullanıcı süzgecin açık
 * olup olmadığını anlayamıyordu. Durum artık üç yoldan okunur: `aria-pressed`
 * (Radix Toggle), açıkken dolu birincil görünüm + onay ikonu ve başlıktaki metin
 * ("Yalnız uyanlar gösteriliyor · 31/40" ↔ "… tümü gösteriliyor"). Hiçbir satır
 * gizlenmese bile açık süzgeç "gösteriliyor" der.
 */
export function vehicleFitSummary({
  active,
  fitting,
  total,
  noun = "parça",
}: {
  active: boolean
  fitting: number
  total: number
  noun?: string
}): string {
  if (active) return `Yalnız uyanlar gösteriliyor · ${fitting}/${total}`
  return `${fitting} ${noun} bu araca uyumlu · tümü gösteriliyor`
}

export function VehicleFitToggle({
  pressed,
  onPressedChange,
  fitting,
  total,
  noun,
  onMouseDown,
  className,
}: {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  fitting: number
  total: number
  noun?: string
  onMouseDown?: MouseEventHandler<HTMLButtonElement>
  className?: string
}) {
  return (
    // Telefonda 44px'lik geniş düğme durum metnini "20 parça bu …"ya sıkıştırıyordu
    // (#854): dar ekranda düğme üstte, metin altında tam görünür; md+ tek satır.
    <div
      className={cn(
        "flex flex-col-reverse items-start gap-1.5 border-b border-border md:flex-row md:items-center md:justify-between md:gap-2",
        className
      )}
    >
      <span
        className={cn("text-xs md:truncate", pressed ? "font-medium text-foreground" : "text-muted-foreground")}
        aria-live="polite"
      >
        {vehicleFitSummary({ active: pressed, fitting, total, noun })}
      </span>
      <Toggle
        variant="outline"
        size="control"
        pressed={pressed}
        onPressedChange={onPressedChange}
        onMouseDown={onMouseDown}
        aria-label="Yalnız bu araca uyan parçaları göster"
        className="shrink-0"
      >
        {pressed ? <Check data-icon="inline-start" /> : <CarFront data-icon="inline-start" />}
        Yalnız bu araca uyanlar
      </Toggle>
    </div>
  )
}
