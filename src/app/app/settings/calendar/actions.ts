"use server"

import { requireAuth } from "@/lib/auth"

export async function getCalendarSettings() {
  await requireAuth()
  const provider = process.env.CALENDAR_PROVIDER || "mock"
  const googleConfigured = !!(process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_CALENDAR_ACCESS_TOKEN)

  return {
    provider,
    googleConfigured,
  }
}