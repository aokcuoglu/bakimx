import { describe, expect, test } from "bun:test"
import {
  closeOpenSessions,
  statusClosesLaborSessions,
  decideStart,
  type LaborCloseIO,
  type OpenLaborSession,
} from "./labor-session-close"

const T0 = new Date("2026-11-27T09:00:00.000Z")
const NOW = new Date("2026-11-27T10:30:00.000Z")

function fakeIO(open: OpenLaborSession[], lost: string[] = []) {
  const writes: { id: string; data: { endTime: Date; durationMinutes: number; note?: string } }[] = []
  const io: LaborCloseIO = {
    listOpen: async () => open,
    closeOne: async (id, data) => {
      if (lost.includes(id)) return 0
      writes.push({ id, data })
      return 1
    },
  }
  return { io, writes }
}

describe("closeOpenSessions", () => {
  test("açık oturum yoksa none", async () => {
    const { io, writes } = fakeIO([])
    expect(await closeOpenSessions(io, NOW)).toEqual({ status: "none" })
    expect(writes).toHaveLength(0)
  })

  test("tek açık oturum süresiyle kapanır", async () => {
    const { io, writes } = fakeIO([{ id: "a", startTime: T0 }])
    const res = await closeOpenSessions(io, NOW)
    expect(res.status).toBe("closed")
    expect(writes[0].data.durationMinutes).toBe(90)
    expect(writes[0].data.endTime).toBe(NOW)
  })

  test("birden çok açık oturumun HEPSİ kapanır", async () => {
    const { io, writes } = fakeIO([
      { id: "a", startTime: T0 },
      { id: "b", startTime: new Date("2026-11-27T10:00:00.000Z") },
    ])
    const res = await closeOpenSessions(io, NOW)
    expect(writes.map((w) => w.id)).toEqual(["a", "b"])
    expect(res.status === "closed" && res.sessions.map((s) => s.durationMinutes)).toEqual([90, 30])
  })

  test("not yalnız en yeni oturuma yazılır, boş not hiç yazılmaz", async () => {
    const open = [
      { id: "a", startTime: T0 },
      { id: "b", startTime: new Date("2026-11-27T10:00:00.000Z") },
    ]
    const withNote = fakeIO(open)
    await closeOpenSessions(withNote.io, NOW, "  balata  ")
    expect(withNote.writes.find((w) => w.id === "a")?.data.note).toBeUndefined()
    expect(withNote.writes.find((w) => w.id === "b")?.data.note).toBe("balata")

    const blank = fakeIO(open)
    await closeOpenSessions(blank.io, NOW, "   ")
    expect(blank.writes.every((w) => !("note" in w.data))).toBe(true)
  })

  test("hepsi başka istekle kapanmışsa raced; biri kaldıysa closed", async () => {
    const open = [
      { id: "a", startTime: T0 },
      { id: "b", startTime: T0 },
    ]
    expect((await closeOpenSessions(fakeIO(open, ["a", "b"]).io, NOW)).status).toBe("raced")
    const partial = await closeOpenSessions(fakeIO(open, ["a"]).io, NOW)
    expect(partial.status === "closed" && partial.sessions.map((s) => s.sessionId)).toEqual(["b"])
  })

  test("saat geriye kayarsa süre negatif olmaz", async () => {
    const { io, writes } = fakeIO([{ id: "a", startTime: new Date("2026-11-27T11:00:00.000Z") }])
    await closeOpenSessions(io, NOW)
    expect(writes[0].data.durationMinutes).toBe(0)
  })
})

describe("decideStart", () => {
  test("onaylı iş başlar: durum değişir, sayaç açılır", () => {
    expect(decideStart("approved", false)).toEqual({ statusChanged: true, createSession: true })
  })

  test("Serviste + sayaç kapalı = devam et: durum aynı, sayaç açılır", () => {
    expect(decideStart("in_progress", false)).toEqual({ statusChanged: false, createSession: true })
  })

  test("Serviste + sayaç açık = çift dokunuş: hata değil, yeni sayaç yok", () => {
    expect(decideStart("in_progress", true)).toEqual({ statusChanged: false, createSession: false })
  })

  test("Parça Bekliyor'dan devam: durum Serviste'ye döner", () => {
    expect(decideStart("waiting_parts", false)).toEqual({ statusChanged: true, createSession: true })
  })

  test("teslime hazır / teslim edilmiş / iptal başlatılamaz", () => {
    for (const s of ["ready_for_delivery", "delivered", "cancelled"] as const) {
      expect(decideStart(s, false)).toEqual({ error: "Bu durum geçişine izin verilmiyor" })
    }
  })
})

describe("statusClosesLaborSessions", () => {
  test("yalnız Serviste sayaç açık kalır", () => {
    expect(statusClosesLaborSessions("in_progress")).toBe(false)
    for (const s of ["draft", "waiting_parts", "ready_for_delivery", "delivered", "cancelled"] as const) {
      expect(statusClosesLaborSessions(s)).toBe(true)
    }
  })
})
