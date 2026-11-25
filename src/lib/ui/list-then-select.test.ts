import { expect, test } from "bun:test"
import { listThenSelect } from "./list-then-select"

test("seçenek eklemesi bittikten sonra seçim yapılır, her biri bir kez", () => {
  const calls: string[] = []
  listThenSelect(
    () => calls.push("add"),
    () => calls.push("select")
  )
  expect(calls).toEqual(["add", "select"])
})
