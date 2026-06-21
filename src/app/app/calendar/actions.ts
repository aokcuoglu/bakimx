"use server"

import { requireAuth } from "@/lib/auth"
import { runAllReminderJobs } from "@/lib/calendar/reminder-scheduler"
import { getCalendarSyncLogs, getReminderExecutionLogs } from "@/lib/calendar"
import { revalidatePath } from "next/cache"

export async function checkRemindersAction() {
  const user = await requireAuth()
  const results = await runAllReminderJobs(user.workshopId)
  revalidatePath("/app/calendar")
  return results.map((r) => ({
    jobType: r.jobType,
    processed: r.processed,
    sent: r.sent,
    failed: r.failed,
  }))
}

export async function getCalendarSettings() {
  const provider = process.env.CALENDAR_PROVIDER || "mock"
  const googleConfigured = !!(process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_CALENDAR_ACCESS_TOKEN)

  return {
    provider,
    googleConfigured,
  }
}

export async function getCalendarLogsAction() {
  const { workshopId } = await requireAuth()
  const [syncLogs, executionLogs] = await Promise.all([
    getCalendarSyncLogs(workshopId, 20),
    getReminderExecutionLogs(workshopId, 20),
  ])

  return { syncLogs, executionLogs }
}