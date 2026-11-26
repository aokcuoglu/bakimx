import { describe, expect, test } from "bun:test"
import { hasReadyNoticeBeenSent, READY_NOTICE_TEMPLATE_KEY } from "./ready-notice"

describe("hasReadyNoticeBeenSent", () => {
  test("ilk hazır geçişinde gönderilmiş kayıt yok: gönderilebilir", async () => {
    expect(await hasReadyNoticeBeenSent(async () => null, "w1", "o1")).toBe(false)
  })

  test("işlemden tekrar hazıra dönüşte gönderilmiş kayıt var: engellenir", async () => {
    expect(await hasReadyNoticeBeenSent(async () => ({ id: "log1" }), "w1", "o1")).toBe(true)
  })

  test("sorgu atölye, şablon, sipariş ve yalnız 'sent' ile sınırlıdır", async () => {
    let seen: unknown
    await hasReadyNoticeBeenSent(async (where) => {
      seen = where
      return null
    }, "w1", "o1")
    expect(seen).toEqual({
      workshopId: "w1",
      templateKey: READY_NOTICE_TEMPLATE_KEY,
      entityType: "order",
      entityId: "o1",
      status: "sent",
    })
  })
})
