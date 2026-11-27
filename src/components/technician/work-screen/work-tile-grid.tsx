"use client"

import { Camera, Package, ShoppingCart, StickyNote, Store, Wrench } from "lucide-react"
import type { ComponentType } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { WorkTileKey } from "@/lib/technician/work-screen"

const TILES: Record<WorkTileKey, { label: string; icon: ComponentType }> = {
  part: { label: "Parça Ekle", icon: Package },
  labor: { label: "İşçilik Ekle", icon: Wrench },
  purchase: { label: "Dış Parça", icon: ShoppingCart },
  externalLabor: { label: "Dış İşçilik", icon: Store },
  photo: { label: "Fotoğraf", icon: Camera },
  note: { label: "Not", icon: StickyNote },
}

/**
 * İş ekranının büyük dokunma kutucukları: görünür olanları `workScreenTiles`
 * (rol + kilit) belirler, bu bileşen yalnız çizer ve dokunuşu yukarı iletir.
 */
export function WorkTileGrid({
  tiles,
  onSelect,
  badges,
}: {
  tiles: WorkTileKey[]
  onSelect: (tile: WorkTileKey) => void
  /** Kutucuğun altında görünen kısa uyarı (ör. "2 eksik" zorunlu fotoğraf). */
  badges?: Partial<Record<WorkTileKey, string>>
}) {
  if (tiles.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((key) => {
        const { label, icon: Icon } = TILES[key]
        return (
          <Button key={key} type="button" variant="outline" size="kiosk" onClick={() => onSelect(key)}>
            <Icon />
            {label}
            {badges?.[key] && <Badge variant="destructive">{badges[key]}</Badge>}
          </Button>
        )
      })}
    </div>
  )
}
