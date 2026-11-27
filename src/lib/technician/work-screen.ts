/**
 * Teknisyen iş ekranının (kiosk, #1036) saf kuralları: hangi kutucuk görünür,
 * büyük tuş ne yapar. React/Prisma yok; sunucu kapıları (`requireWritableWorkshop`)
 * değişmez — buradaki karar onların UI'daki ikizidir, "bas, hata al" tuşu göstermemek için.
 */

import { actorCan } from "@/lib/roles"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus, UserRole } from "@prisma/client"

export type WorkScreenPermissions = {
  /** `order.edit` — kalem, dış işçilik, not. */
  canEditOrder: boolean
  /** `order.status` — başlat / ara ver / bekle / bitir. */
  canChangeStatus: boolean
  /** `parts.purchase` — dış parça. */
  canPurchase: boolean
  /** `records.create` — fotoğraf. */
  canAddPhoto: boolean
}

/**
 * `hasProcurement`: atölyenin planı `procurement` özelliğini içeriyor mu
 * (`hasWorkshopFeature(workshop, "procurement")`). Dış parça sunucuda hem izni
 * hem özelliği ister; ikisi de yoksa kutucuk "bas, hata al" olurdu.
 */
export function workScreenPermissions(
  actor: {
    role: UserRole
    teamPermissions?: readonly string[] | null
  },
  hasProcurement: boolean,
): WorkScreenPermissions {
  return {
    canEditOrder: actorCan(actor, "order.edit"),
    canChangeStatus: actorCan(actor, "order.status"),
    canPurchase: hasProcurement && actorCan(actor, "parts.purchase"),
    canAddPhoto: actorCan(actor, "records.create"),
  }
}

export type WorkTileKey = "part" | "labor" | "purchase" | "externalLabor" | "photo" | "note"

/** Kutucuklar sabit sırada; kilitli işte hiçbiri yok. */
export function workScreenTiles(p: WorkScreenPermissions, locked: boolean): WorkTileKey[] {
  if (locked) return []
  const tiles: WorkTileKey[] = []
  if (p.canEditOrder) tiles.push("part", "labor")
  if (p.canPurchase) tiles.push("purchase")
  if (p.canEditOrder) tiles.push("externalLabor")
  if (p.canAddPhoto) tiles.push("photo")
  if (p.canEditOrder) tiles.push("note")
  return tiles
}

export type WorkPrimaryAction = "start" | "resume" | "pause" | null

// `draft` ve `waiting_parts` dahil: güncel akışta emirler draft'tan doğrudan
// in_progress'e geçiyor (status-transitions.ts) ve Parça Bekliyor'dan iş
// teknisyenin kendi ekranından sürdürülebilmeli.
const STARTABLE: readonly string[] = ["draft", "waiting_approval", "approved", "waiting_parts"]

export function workPrimaryAction(
  status: string,
  hasActiveLabor: boolean,
  canChangeStatus: boolean,
): WorkPrimaryAction {
  if (!canChangeStatus) return null
  if (isOrderLocked(status as OrderStatus) || status === "ready_for_delivery") return null
  if (hasActiveLabor) return "pause"
  if (status === "in_progress") return "resume"
  return STARTABLE.includes(status) ? "start" : null
}

/** "Parça bekliyor" yalnız Serviste'dir. */
export function canHoldWork(status: string, canChangeStatus: boolean): boolean {
  return canChangeStatus && status === "in_progress"
}

/** "İşi Bitir" yalnız Serviste / Parça Bekliyor'da. */
export function canCompleteWork(status: string, canChangeStatus: boolean): boolean {
  return canChangeStatus && (status === "in_progress" || status === "waiting_parts")
}
