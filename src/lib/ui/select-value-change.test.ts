import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { resolveSelectValueChange } from "./select-value-change"

const S = "__bakimx-empty__"

test("nöbetçi değer çağrı yerine boş dize olarak döner", () => {
  expect(resolveSelectValueChange(S, "a", S)).toBe("")
  expect(resolveSelectValueChange(S, "", S)).toBe("")
})

test("dolu kontrollü değer varken ham boş dize sahte yayımdır, yutulur (#907)", () => {
  expect(resolveSelectValueChange("", "veh-1", S)).toBeNull()
})

test("değer zaten boşsa ya da kontrolsüzse ham boş dize geçer", () => {
  expect(resolveSelectValueChange("", "", S)).toBe("")
  expect(resolveSelectValueChange("", undefined, S)).toBe("")
})

test("normal seçim aynen geçer", () => {
  expect(resolveSelectValueChange("b", "a", S)).toBe("b")
})

test("select.tsx koruyu onValueChange sınırında kullanır (#907)", () => {
  const src = readFileSync(join(import.meta.dir, "..", "..", "components", "ui", "select.tsx"), "utf8")
  expect(src).toContain("resolveSelectValueChange(value, props.value, EMPTY_VALUE)")
})
