export const WORKSHOP_ACTIVITY_PAGE_SIZE = 10

export type ActivityDateRange = {
  gte?: Date
  lt?: Date
}

export type ActivityQueryInput = {
  workshopId: string
  from: string
  to: string
  page: number
}

type CalendarDate = { year: number; month: number; day: number }

function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const candidate = new Date(Date.UTC(year, month - 1, day))

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null

  return { year, month, day }
}

function istanbulMidnight(date: CalendarDate, nextDay = false): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day + (nextDay ? 1 : 0), -3))
}

export function parseActivityDateRange(from: string, to: string):
  | { ok: true; range: ActivityDateRange | undefined }
  | { ok: false; error: string } {
  const parsedFrom = from ? parseCalendarDate(from) : null
  const parsedTo = to ? parseCalendarDate(to) : null

  if ((from && !parsedFrom) || (to && !parsedTo)) {
    return { ok: false, error: "Geçerli bir tarih aralığı seçin." }
  }

  const gte = parsedFrom ? istanbulMidnight(parsedFrom) : undefined
  const lt = parsedTo ? istanbulMidnight(parsedTo, true) : undefined
  if (gte && lt && gte >= lt) {
    return { ok: false, error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." }
  }

  return {
    ok: true,
    range: gte || lt ? { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } : undefined,
  }
}

export function normalizeActivityPage(page: number, total: number): number {
  const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1
  const lastPage = Math.max(1, Math.ceil(total / WORKSHOP_ACTIVITY_PAGE_SIZE))
  return Math.min(requestedPage, lastPage)
}

export function validWorkshopActivityId(workshopId: string): boolean {
  return typeof workshopId === "string" && workshopId.length > 0 && workshopId.length <= 191
}
