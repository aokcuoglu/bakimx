import { istanbulDayStart } from "@/lib/istanbul-time"

export type ReminderStatus = "upcoming" | "due_soon" | "overdue" | "completed" | "postponed" | "cancelled"

/**
 * Gün karşılaştırmaları Türkiye takvimine göredir (#904): `dueDate` formda
 * `YYYY-MM-DD` olarak seçilip İstanbul gece yarısı olarak yazılır (#933 öncesi
 * kayıtlar UTC gece yarısı, TR 03:00); `istanbulDayStart` ikisini de seçilen güne, `now`'ı da bugünün TR gününe oturtur.
 * Süreç UTC'de koşsa da TR 00:00–03:00 arasında dünkü kayıt gecikmiş sayılır.
 */
export function deriveReminderStatus(input: {
  status?: string | null
  dueDate?: string | Date | null
  dueMileage?: number | null
  currentMileage?: number | null
  reminderDaysBefore?: number | null
  reminderKmBefore?: number | null
}, now: Date = new Date()): ReminderStatus {
  const { status, dueDate, dueMileage, currentMileage, reminderDaysBefore, reminderKmBefore } = input

  if (status === "completed" || status === "postponed" || status === "cancelled") {
    return status as ReminderStatus
  }

  const today = istanbulDayStart(now)

  let isOverdue = false
  let isDueSoon = false

  if (dueDate) {
    const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate
    const dueDay = istanbulDayStart(due)

    if (dueDay < today) {
      isOverdue = true
    } else if (reminderDaysBefore != null && reminderDaysBefore > 0) {
      const warnThreshold = istanbulDayStart(now, reminderDaysBefore)
      if (dueDay <= warnThreshold) {
        isDueSoon = true
      }
    }
  }

  if (dueMileage != null && currentMileage != null) {
    if (currentMileage >= dueMileage) {
      isOverdue = true
    } else if (reminderKmBefore != null && reminderKmBefore > 0) {
      if (dueMileage - currentMileage <= reminderKmBefore) {
        isDueSoon = true
      }
    }
  }

  if (isOverdue) return "overdue"
  if (isDueSoon) return "due_soon"
  return "upcoming"
}

export function getStatusFromDueDates(args: {
  dueDate?: string | Date | null
  dueMileage?: number | null
  currentMileage?: number | null
  reminderDaysBefore?: number | null
  reminderKmBefore?: number | null
}, now: Date = new Date()): ReminderStatus {
  return deriveReminderStatus({ status: "upcoming", ...args }, now)
}
