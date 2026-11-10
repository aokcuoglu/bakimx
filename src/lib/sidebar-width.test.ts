import { describe, expect, test } from "bun:test"
import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  parseSidebarWidth,
} from "./sidebar-width"

describe("sidebar width", () => {
  test("keeps dragging within usable desktop bounds", () => {
    expect(clampSidebarWidth(100)).toBe(MIN_SIDEBAR_WIDTH)
    expect(clampSidebarWidth(350.6)).toBe(351)
    expect(clampSidebarWidth(900)).toBe(MAX_SIDEBAR_WIDTH)
  })

  test("accepts only stored whole pixel widths", () => {
    expect(parseSidebarWidth(String(DEFAULT_SIDEBAR_WIDTH))).toBe(DEFAULT_SIDEBAR_WIDTH)
    expect(parseSidebarWidth("999")).toBe(MAX_SIDEBAR_WIDTH)
    expect(parseSidebarWidth(null)).toBeNull()
    expect(parseSidebarWidth("bad")).toBeNull()
    expect(parseSidebarWidth("12.5")).toBeNull()
  })
})
