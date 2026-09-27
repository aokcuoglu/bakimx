export const DEFAULT_SIDEBAR_WIDTH = 256
export const MIN_SIDEBAR_WIDTH = 224
export const MAX_SIDEBAR_WIDTH = 480
export const SIDEBAR_WIDTH_STORAGE_KEY = "bakimx-sidebar-width"

export function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)))
}

export function parseSidebarWidth(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null
  const width = Number(value)
  return Number.isSafeInteger(width) ? clampSidebarWidth(width) : null
}
