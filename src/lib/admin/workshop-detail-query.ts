export const WORKSHOP_ORDER_PAGE_SIZE = 10

export const BILLING_ORDER_STATUSES = ["pending_payment", "confirmed", "cancelled"] as const
export const WORKSHOP_PLAN_TIERS = ["lite", "starter", "pro", "premium"] as const
export const BILLING_CYCLES = ["monthly", "yearly"] as const
export const USAGE_FILTER_PARAMS = ["from", "to"] as const
export const ORDER_FILTER_PARAMS = ["orderFrom", "orderTo", "orderStatus", "orderPlan", "orderCycle", "orderPage"] as const

type QueryValue = string | string[] | undefined

export type WorkshopDetailSearchParams = {
  from?: QueryValue
  to?: QueryValue
  orderFrom?: QueryValue
  orderTo?: QueryValue
  orderStatus?: QueryValue
  orderPlan?: QueryValue
  orderCycle?: QueryValue
  orderPage?: QueryValue
  [key: string]: QueryValue
}

export type WorkshopDateRange = {
  from: string
  to: string
  range?: {
    gte?: Date
    lt?: Date
  }
}

export type WorkshopOrderFilters = WorkshopDateRange & {
  status: (typeof BILLING_ORDER_STATUSES)[number] | ""
  plan: (typeof WORKSHOP_PLAN_TIERS)[number] | ""
  cycle: (typeof BILLING_CYCLES)[number] | ""
  requestedPage: number
}

type CalendarDate = { year: number; month: number; day: number }

function first(value: QueryValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

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

function calendarDateKey(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day)
}

export function parseWorkshopDateRange(fromValue: QueryValue, toValue: QueryValue): WorkshopDateRange {
  const rawFrom = first(fromValue)
  const rawTo = first(toValue)
  const parsedFrom = parseCalendarDate(rawFrom)
  const parsedTo = parseCalendarDate(rawTo)

  if (parsedFrom && parsedTo && calendarDateKey(parsedFrom) > calendarDateKey(parsedTo)) {
    return { from: "", to: "" }
  }

  const from = parsedFrom ? rawFrom : ""
  const to = parsedTo ? rawTo : ""
  const gte = parsedFrom ? istanbulMidnight(parsedFrom) : undefined
  const lt = parsedTo ? istanbulMidnight(parsedTo, true) : undefined

  return {
    from,
    to,
    ...(gte || lt
      ? { range: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } }
      : {}),
  }
}

function enumValue<const T extends readonly string[]>(value: QueryValue, values: T): T[number] | "" {
  const candidate = first(value)
  return values.includes(candidate) ? candidate as T[number] : ""
}

function positivePage(value: QueryValue): number {
  const candidate = first(value)
  if (!/^[1-9]\d*$/.test(candidate)) return 1
  const page = Number(candidate)
  return Number.isSafeInteger(page) ? page : 1
}

export function parseWorkshopOrderFilters(params: WorkshopDetailSearchParams): WorkshopOrderFilters {
  return {
    ...parseWorkshopDateRange(params.orderFrom, params.orderTo),
    status: enumValue(params.orderStatus, BILLING_ORDER_STATUSES),
    plan: enumValue(params.orderPlan, WORKSHOP_PLAN_TIERS),
    cycle: enumValue(params.orderCycle, BILLING_CYCLES),
    requestedPage: positivePage(params.orderPage),
  }
}

export function normalizeWorkshopOrderPage(requestedPage: number, total: number): number {
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const lastPage = Math.max(1, Math.ceil(total / WORKSHOP_ORDER_PAGE_SIZE))
  return Math.min(page, lastPage)
}

export function hasWorkshopOrderFilters(filters: WorkshopOrderFilters): boolean {
  return Boolean(filters.from || filters.to || filters.status || filters.plan || filters.cycle)
}

export function replaceWorkshopDetailFilterParams(
  current: string,
  keys: readonly string[],
  values: Readonly<Record<string, string | undefined>> = {},
): string {
  const params = new URLSearchParams(current)
  for (const key of keys) {
    const value = values[key]
    if (value) params.set(key, value)
    else params.delete(key)
  }
  return params.toString()
}
