import { expect, test } from "bun:test"
import { sendSystemEmail, type SystemEmailLogEntry } from "./send-system-email"

test("sendSystemEmail başarıda ok döner ve sent loglar", async () => {
  const logs: SystemEmailLogEntry[] = []
  const res = await sendSystemEmail(
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "workshop_approved", audience: "workshop" },
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
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "workshop_rejected", audience: "workshop" },
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
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "application_received", audience: "workshop" },
    {
      send: async () => ({ success: true, providerId: "id-2" }),
      log: async () => { throw new Error("DB down") },
    },
  )
  expect(res.ok).toBe(true)
})

// --- issue #194: hedef kitle → görünürlük bayrağı ---

test("audience 'internal' kaydı internal=true loglar (kiracıya gösterilmez)", async () => {
  const logs: SystemEmailLogEntry[] = []
  await sendSystemEmail(
    {
      to: "hey@bakimx.com,emre@bakimx.com",
      subject: "Yeni başvuru",
      html: "<p>x</p>",
      workshopId: "w1",
      templateKey: "new_application_admin",
      audience: "internal",
    },
    { send: async () => ({ success: true }), log: async (e) => { logs.push(e) } },
  )
  expect(logs[0].internal).toBe(true)
  // workshopId dedup için korunur — bayrak yalnız görünürlüğü kapatır.
  expect(logs[0].workshopId).toBe("w1")
})

test("audience 'workshop' kaydı internal=false loglar (kiracı görebilir)", async () => {
  const logs: SystemEmailLogEntry[] = []
  await sendSystemEmail(
    { to: "owner@atolye.com", subject: "Hoş geldiniz", html: "<p>x</p>", workshopId: "w1", templateKey: "welcome_trial", audience: "workshop" },
    { send: async () => ({ success: true }), log: async (e) => { logs.push(e) } },
  )
  expect(logs[0].internal).toBe(false)
})

test("gönderim başarısız olsa da internal bayrağı korunur", async () => {
  const logs: SystemEmailLogEntry[] = []
  await sendSystemEmail(
    { to: "hey@bakimx.com", subject: "Alarm", html: "<p>x</p>", workshopId: "w1", templateKey: "stuck_txn_alert:t1", audience: "internal" },
    { send: async () => ({ success: false, error: "boom" }), log: async (e) => { logs.push(e) } },
  )
  expect(logs[0].status).toBe("failed")
  expect(logs[0].internal).toBe(true)
})
