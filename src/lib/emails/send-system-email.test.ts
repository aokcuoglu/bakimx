import { expect, test } from "bun:test"
import { sendSystemEmail, type SystemEmailLogEntry } from "./send-system-email"

test("sendSystemEmail başarıda ok döner ve sent loglar", async () => {
  const logs: SystemEmailLogEntry[] = []
  const res = await sendSystemEmail(
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "workshop_approved" },
    {
      send: async () => ({ success: true, providerId: "id-1" }),
      log: async (e) => { logs.push(e) },
    },
  )
  expect(res.ok).toBe(true)
  expect(logs[0].status).toBe("sent")
  expect(logs[0].providerId).toBe("id-1")
})

test("sendSystemEmail send hatasını yutar, ok=false döner, failed loglar", async () => {
  const logs: SystemEmailLogEntry[] = []
  const res = await sendSystemEmail(
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "workshop_rejected" },
    {
      send: async () => { throw new Error("SMTP down") },
      log: async (e) => { logs.push(e) },
    },
  )
  expect(res.ok).toBe(false)
  expect(res.error).toContain("SMTP down")
  expect(logs[0].status).toBe("failed")
})

test("sendSystemEmail log hatası çağıranı bozmaz", async () => {
  const res = await sendSystemEmail(
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "application_received" },
    {
      send: async () => ({ success: true, providerId: "id-2" }),
      log: async () => { throw new Error("DB down") },
    },
  )
  expect(res.ok).toBe(true)
})
