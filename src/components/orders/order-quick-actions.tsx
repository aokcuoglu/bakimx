"use client"

import { Camera, PackagePlus, Wallet, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OrderQuickAction } from "@/lib/orders/quick-actions"

const QUICK_ACTIONS: Record<OrderQuickAction, { label: string; Icon: typeof Camera }> = {
  parca: { label: "Parça ekle", Icon: PackagePlus },
  iscilik: { label: "İşçilik ekle", Icon: Wrench },
  foto: { label: "Fotoğraf ekle", Icon: Camera },
  tahsilat: { label: "Tahsilat al", Icon: Wallet },
}

/**
 * Başlığın altındaki hızlı butonlar (#881). Telefonda 2×2 ızgara (her hücre
 * 44px dokunma alanı), masaüstünde tek sıra. Hangi butonların görüneceği
 * `orderQuickActions`tadır; burası yalnız çizer.
 */
export function OrderQuickActions({
  actions,
  onAction,
}: {
  actions: readonly OrderQuickAction[]
  onAction: (action: OrderQuickAction) => void
}) {
  if (actions.length === 0) return null
  return (
    <div role="group" aria-label="Hızlı işlemler" className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
      {actions.map((action) => {
        const { label, Icon } = QUICK_ACTIONS[action]
        return (
          <Button key={action} type="button" variant="outline" onClick={() => onAction(action)}>
            <Icon aria-hidden className="text-primary" />
            {label}
          </Button>
        )
      })}
    </div>
  )
}
