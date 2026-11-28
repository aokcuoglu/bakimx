/**
 * İşçilik sayacı kapatma ve başlatma kararının saf çekirdeği. Veri erişimi
 * çağıranın verdiği küçük bir arayüzdür (Prisma tx'i orada bağlanır); böylece
 * davranış `mock.module` olmadan sahte bir arayüzle test edilir.
 */

import { canTransitionOrder } from "@/lib/status-transitions"
import { workPrimaryAction } from "./work-screen"
import type { OrderStatus } from "@prisma/client"

export type ClosedLaborSession = {
  sessionId: string
  startTime: Date
  endTime: Date
  durationMinutes: number
  note: string | null
}

export interface OpenLaborSession {
  id: string
  startTime: Date
}

export interface LaborCloseIO {
  /** İş emrinin açık (endTime null) tüm oturumları; tenant kapsamı çağıranda. */
  listOpen: () => Promise<OpenLaborSession[]>
  /** Koşullu kapatma (`endTime: null`); yazılan satır sayısını döner. */
  closeOne: (
    id: string,
    data: { endTime: Date; durationMinutes: number; note?: string },
  ) => Promise<number>
}

export type CloseOutcome =
  | { status: "none" }
  | { status: "raced" }
  | { status: "closed"; sessions: ClosedLaborSession[] }

/**
 * İş emrinin TÜM açık oturumlarını kapatır (normalde en fazla bir tane olmalı;
 * çift başlatma kalıntısı kalmasın diye hepsi kapanır). Not YALNIZ doluysa ve
 * yalnız en yeni oturuma yazılır: boş gönderim var olan notu silmesin.
 * Hepsi başka bir istekle kapanmışsa `"raced"`.
 */
export async function closeOpenSessions(
  io: LaborCloseIO,
  now: Date,
  note?: string | null,
): Promise<CloseOutcome> {
  const open = await io.listOpen()
  if (open.length === 0) return { status: "none" }

  const cleanNote = note?.trim() || null
  const newest = open.reduce((a, b) => (b.startTime > a.startTime ? b : a))
  const sessions: ClosedLaborSession[] = []

  for (const s of open) {
    const durationMinutes = Math.max(0, Math.round((now.getTime() - s.startTime.getTime()) / 60000))
    const sessionNote = s.id === newest.id ? cleanNote : null
    const written = await io.closeOne(s.id, {
      endTime: now,
      durationMinutes,
      ...(sessionNote ? { note: sessionNote } : {}),
    })
    if (written === 0) continue
    sessions.push({
      sessionId: s.id,
      startTime: s.startTime,
      endTime: now,
      durationMinutes,
      note: sessionNote,
    })
  }
  return sessions.length === 0 ? { status: "raced" } : { status: "closed", sessions }
}

export type StartDecision =
  | { error: string }
  | { statusChanged: boolean; createSession: boolean }

/**
 * "İşi Başlat / Devam Et" kararı (kilit alındıktan sonraki GÜNCEL durumla).
 * Açık sayaç + Serviste = çift dokunuş: hata değil, `createSession: false`.
 */
export function decideStart(status: OrderStatus, hasActiveSession: boolean): StartDecision {
  const blocked = { error: "Bu durum geçişine izin verilmiyor" }
  if (workPrimaryAction(status, hasActiveSession, true) === null) return blocked
  const statusChanged = status !== "in_progress"
  if (statusChanged && !canTransitionOrder(status, "in_progress")) return blocked
  return { statusChanged, createSession: !hasActiveSession }
}

/**
 * Sayaç yalnız Serviste (`in_progress`) akar: emir başka bir duruma geçerken
 * (parça bekliyor, teslime hazır, teslim, iptal, taslak…) açık oturumlar
 * kapanır. Teknisyen "beklet/bitir" ile ofis durum eylemi aynı kuralı paylaşır.
 */
export function statusClosesLaborSessions(next: OrderStatus): boolean {
  return next !== "in_progress"
}
