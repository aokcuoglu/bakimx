import { test, expect } from "bun:test"
import type { OrderStatus } from "@prisma/client"
import {
  purchaseDeleteDecision,
  canDeletePurchaseItem,
  PURCHASE_DELETE_LOCKED_REASON,
  PURCHASE_DELETE_OFFICE_ONLY_REASON,
} from "./purchase-delete"
import { ORDER_STATUSES } from "@/lib/status-transitions"

const OPEN_STATUSES: OrderStatus[] = [
  "draft",
  "waiting_approval",
  "approved",
  "in_progress",
  "waiting_parts",
]

test("açık iş emrinde parça alan kişi (parts.purchase) kendi kaydını silebilir", () => {
  for (const status of OPEN_STATUSES) {
    expect(canDeletePurchaseItem(status, false)).toBe(true)
    expect(canDeletePurchaseItem(status, true)).toBe(true)
  }
})

test("teslim edilmiş/iptal edilmiş iş emrinde kimse silemez", () => {
  for (const status of ["delivered", "cancelled"] as OrderStatus[]) {
    expect(purchaseDeleteDecision(status, false)).toEqual({
      allowed: false,
      reason: PURCHASE_DELETE_LOCKED_REASON,
    })
    // `order.edit` de kilidi açmaz — kapalı kayıt önce yeniden açılmalı.
    expect(purchaseDeleteDecision(status, true)).toEqual({
      allowed: false,
      reason: PURCHASE_DELETE_LOCKED_REASON,
    })
  }
})

test("teslime hazır iş emrinde yalnız order.edit taşıyan roller silebilir", () => {
  expect(purchaseDeleteDecision("ready_for_delivery", false)).toEqual({
    allowed: false,
    reason: PURCHASE_DELETE_OFFICE_ONLY_REASON,
  })
  expect(purchaseDeleteDecision("ready_for_delivery", true)).toEqual({ allowed: true })
})

test("her iş emri durumu kuralda karşılanır — yeni durum sessizce izinli sayılmaz", () => {
  const covered = new Set<string>([...OPEN_STATUSES, "ready_for_delivery", "delivered", "cancelled"])
  expect([...ORDER_STATUSES].filter((s) => !covered.has(s))).toEqual([])
})
