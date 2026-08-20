import { describe, expect, test } from "bun:test"
import { COMPARISON_PATH, COMPARISON_ROWS } from "./defter-excel-oto-servis-programi"

describe("comparison landing contract", () => {
  test("uses the canonical comparison path", () => {
    expect(COMPARISON_PATH).toBe("/karsilastir/defter-excel-oto-servis-programi")
  })

  test("keeps every option represented for each criterion", () => {
    expect(COMPARISON_ROWS.length).toBeGreaterThanOrEqual(5)
    for (const row of COMPARISON_ROWS) {
      expect(row.criterion).toBeTruthy()
      expect(row.notebook).toBeTruthy()
      expect(row.spreadsheet).toBeTruthy()
      expect(row.software).toBeTruthy()
    }
  })
})
