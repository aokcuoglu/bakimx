import { describe, expect, test } from "bun:test"

import { ORDER_LIST_DATA_COLUMN_ORDER } from "./list-columns"

describe("order list columns", () => {
  test("technician is the last data column", () => {
    expect(ORDER_LIST_DATA_COLUMN_ORDER.at(-1)).toBe("technician")
    expect(ORDER_LIST_DATA_COLUMN_ORDER.indexOf("dates")).toBeLessThan(
      ORDER_LIST_DATA_COLUMN_ORDER.indexOf("technician"),
    )
  })
})
