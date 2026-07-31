import { test, expect } from "bun:test"
import { canTransitionIntake, canTransitionOrder, isOrderLocked, isIntakeWriteLocked, isCollectionLockedForOrder, orderStatusOptions, ORDER_STATUSES } from "./status-transitions"

test("delivered'a manuel geçiş reddedilir (yalnız OTP ile)", () => {
  expect(canTransitionIntake("ready_for_delivery", "delivered")).toBe(false)
})

test("approved'a manuel geçiş reddedilir (mevcut davranış korunur)", () => {
  expect(canTransitionIntake("waiting_approval", "approved")).toBe(false)
})

test("izinli geçiş hâlâ çalışır (in_progress → ready_for_delivery)", () => {
  expect(canTransitionIntake("in_progress", "ready_for_delivery")).toBe(true)
})

test("delivered ve cancelled kilitli sayılır", () => {
  expect(isOrderLocked("delivered")).toBe(true)
  expect(isOrderLocked("cancelled")).toBe(true)
})

test("aktif durumlar kilitli değildir", () => {
  expect(isOrderLocked("draft")).toBe(false)
  expect(isOrderLocked("in_progress")).toBe(false)
  expect(isOrderLocked("waiting_parts")).toBe(false)
  expect(isOrderLocked("ready_for_delivery")).toBe(false)
})

test("intake yazma kilidi: teslim/iptal edilen intake kilitli", () => {
  expect(isIntakeWriteLocked("delivered")).toBe(true)
  expect(isIntakeWriteLocked("cancelled")).toBe(true)
  expect(isIntakeWriteLocked("in_progress")).toBe(false)
  expect(isIntakeWriteLocked("draft")).toBe(false)
})

test("intake yazma kilidi: bağlı order teslim/iptal ise kilitli", () => {
  expect(isIntakeWriteLocked("in_progress", "delivered")).toBe(true)
  expect(isIntakeWriteLocked("in_progress", "cancelled")).toBe(true)
  expect(isIntakeWriteLocked("in_progress", "in_progress")).toBe(false)
  expect(isIntakeWriteLocked("in_progress", null)).toBe(false)
})

test("tahsilat kilidi: teslim edilmiş + tam ödenmiş kilitli", () => {
  expect(isCollectionLockedForOrder("delivered", "paid")).toBe(true)
  expect(isCollectionLockedForOrder("delivered", "overpaid")).toBe(true)
})

test("tahsilat kilidi: teslim edilmiş ama borçlu AÇIK", () => {
  expect(isCollectionLockedForOrder("delivered", "unpaid")).toBe(false)
  expect(isCollectionLockedForOrder("delivered", "partial")).toBe(false)
})

test("tahsilat kilidi: teslim edilmemişse ödenmiş olsa da AÇIK", () => {
  expect(isCollectionLockedForOrder("in_progress", "paid")).toBe(false)
  expect(isCollectionLockedForOrder("ready_for_delivery", "paid")).toBe(false)
})

test("orderStatusOptions mevcut durumu ve izinli hedefleri listeler", () => {
  expect(orderStatusOptions("in_progress")).toEqual([
    "in_progress",
    "waiting_parts",
    "ready_for_delivery",
    "cancelled",
  ])
})

test("orderStatusOptions taslakta başlama ve iptali sunar", () => {
  // Emekli onay akışı (waiting_approval) hedef olarak SUNULMAZ.
  expect(orderStatusOptions("draft")).toEqual(["draft", "in_progress", "cancelled"])
})

test("orderStatusOptions emekli onay statülerini hedef olarak sunmaz", () => {
  for (const status of ORDER_STATUSES) {
    const targets = orderStatusOptions(status).slice(1)
    expect(targets).not.toContain("waiting_approval")
    expect(targets).not.toContain("approved")
  }
})

test("orderStatusOptions emir zaten emekli statüdeyse onu listede tutar", () => {
  // Eski kayıtlar doğru görünsün diye mevcut durum her zaman ilk eleman.
  expect(orderStatusOptions("waiting_approval")).toEqual(["waiting_approval", "in_progress", "cancelled"])
  expect(orderStatusOptions("approved")).toEqual(["approved", "in_progress", "waiting_parts", "cancelled"])
})

test("orderStatusOptions teslim edilmiş emirde yalnız mevcut durumu döner", () => {
  expect(orderStatusOptions("delivered")).toEqual(["delivered"])
})

test("orderStatusOptions hiçbir durumda tekrar eden değer üretmez", () => {
  for (const status of ORDER_STATUSES) {
    const options = orderStatusOptions(status)
    expect(new Set(options).size).toBe(options.length)
  }
})

test("orderStatusOptions'ın döndürdüğü her hedefe geçiş gerçekten izinli", () => {
  for (const status of ORDER_STATUSES) {
    for (const target of orderStatusOptions(status)) {
      expect(canTransitionOrder(status, target)).toBe(true)
    }
  }
})
