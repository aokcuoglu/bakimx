export type ReminderStatus = "upcoming" | "due_soon" | "overdue" | "completed" | "postponed" | "cancelled"

export function deriveReminderStatus(input: {
  status?: string | null
  dueDate?: string | Date | null
  dueMileage?: number | null
  currentMileage?: number | null
  reminderDaysBefore?: number | null
  reminderKmBefore?: number | null
}): ReminderStatus {
  const { status, dueDate, dueMileage, currentMileage, reminderDaysBefore, reminderKmBefore } = input

  if (status === "completed" || status === "postponed" || status === "cancelled") {
    return status as ReminderStatus
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  let isOverdue = false
  let isDueSoon = false

  if (dueDate) {
    const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 0, 0, 0, 0)

    if (dueDay < today) {
      isOverdue = true
    } else if (reminderDaysBefore != null && reminderDaysBefore > 0) {
      const warnThreshold = new Date(today.getTime() + reminderDaysBefore * 86400000)
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
}): ReminderStatus {
  return deriveReminderStatus({ status: "upcoming", ...args })
}
