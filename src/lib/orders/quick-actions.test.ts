import { expect, test } from "bun:test"
import { orderQuickActions } from "./quick-actions"

test("açık emirde dört hızlı buton, sabit sırada", () => {
  expect(orderQuickActions({ orderLocked: false, canCashbox: true, collectionsLocked: false })).toEqual([
    "parca",
    "iscilik",
    "foto",
    "tahsilat",
  ])
})

test("teslim edilmiş emirde yalnız tahsilat kalır (teslim sonrası ödeme)", () => {
  expect(orderQuickActions({ orderLocked: true, canCashbox: true, collectionsLocked: false })).toEqual(["tahsilat"])
})

test("kasa özelliği kapalıysa tahsilat butonu yok", () => {
  expect(orderQuickActions({ orderLocked: false, canCashbox: false, collectionsLocked: false })).toEqual([
    "parca",
    "iscilik",
    "foto",
  ])
})

test("iptal / tahsilatı kapanmış emirde hiçbir buton yok", () => {
  expect(orderQuickActions({ orderLocked: true, canCashbox: true, collectionsLocked: true })).toEqual([])
})
