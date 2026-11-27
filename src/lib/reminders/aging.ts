import { prisma } from "@/lib/db"
import { deriveReminderStatus, type ReminderStatus } from "@/lib/reminders/status"

type AgingCandidate = {
  id: string
  workshopId: string
  status: string
  dueDate: Date | null
  dueMileage: number | null
  currentMileage: number | null
  reminderDaysBefore: number | null
  reminderKmBefore: number | null
}

/**
 * Kayıtlı durumu şimdiki zamana göre değişmesi gereken kayıtları bulur (#932).
 * Saf fonksiyon: `completed` / `postponed` / `cancelled` aday bile değildir
 * (`deriveReminderStatus` onları olduğu gibi döndürür), yalnız farklı çıkanlar
 * yeni duruma göre gruplanır.
 */
export function planReminderStatusAging(
  candidates: AgingCandidate[],
  now: Date
): Map<ReminderStatus, { id: string; workshopId: string }[]> {
  const changes = new Map<ReminderStatus, { id: string; workshopId: string }[]>()
  for (const c of candidates) {
    const next = deriveReminderStatus(c, now)
    if (next === c.status) continue
    const bucket = changes.get(next) ?? []
    bucket.push({ id: c.id, workshopId: c.workshopId })
    changes.set(next, bucket)
  }
  return changes
}

/**
 * Aktif hatırlatmaların kayıtlı durumunu (`upcoming` → `due_soon` → `overdue`)
 * zamanla günceller. Durum yalnız oluşturma/düzenlemede hesaplanıyordu; liste
 * filtresi, sayaçlar ve zamanlayıcı kayıtlı sütuna baktığı için bayat kalıyordu.
 *
 * İdempotent: ikinci koşu hiçbir şey değiştirmez. Her güncelleme `workshopId` ile
 * kapsanır; `workshopId` verilirse yalnız o atölye taranır.
 */
export async function ageReminderStatuses(workshopId?: string, now: Date = new Date()): Promise<number> {
  const candidates = await prisma.maintenanceReminder.findMany({
    where: {
      ...(workshopId ? { workshopId } : {}),
      status: { in: ["upcoming", "due_soon"] },
    },
    select: {
      id: true,
      workshopId: true,
      status: true,
      dueDate: true,
      dueMileage: true,
      currentMileage: true,
      reminderDaysBefore: true,
      reminderKmBefore: true,
    },
  })

  const changes = planReminderStatusAging(candidates, now)
  let updated = 0
  for (const [status, rows] of changes) {
    const byWorkshop = new Map<string, string[]>()
    for (const r of rows) byWorkshop.set(r.workshopId, [...(byWorkshop.get(r.workshopId) ?? []), r.id])
    for (const [wid, ids] of byWorkshop) {
      const res = await prisma.maintenanceReminder.updateMany({
        where: { workshopId: wid, id: { in: ids }, status: { in: ["upcoming", "due_soon"] } },
        data: { status },
      })
      updated += res.count
    }
  }
  return updated
}
