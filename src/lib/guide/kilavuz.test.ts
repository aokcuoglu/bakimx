import { describe, expect, test } from "bun:test"
import {
  KILAVUZ_PATH,
  KILAVUZ_SECTIONS,
  guideSectionSearchText,
} from "@/lib/guide/kilavuz"

describe("kilavuz content", () => {
  test("path and section count", () => {
    expect(KILAVUZ_PATH).toBe("/kilavuz")
    expect(KILAVUZ_SECTIONS.length).toBeGreaterThanOrEqual(8)
  })

  test("section ids are unique and slug-shaped", () => {
    const ids = KILAVUZ_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  test("every section has a title and at least one block", () => {
    for (const section of KILAVUZ_SECTIONS) {
      expect(section.title.trim().length).toBeGreaterThan(0)
      expect(section.blocks.length).toBeGreaterThan(0)
    }
  })

  test("search text includes title", () => {
    const first = KILAVUZ_SECTIONS[0]!
    expect(guideSectionSearchText(first)).toContain(first.title.toLocaleLowerCase("tr-TR"))
  })
})
