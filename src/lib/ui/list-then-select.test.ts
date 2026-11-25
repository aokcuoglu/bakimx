import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { listThenSelect } from "./list-then-select"

test("seçenek eklemesi bittikten sonra seçim yapılır, her biri bir kez", () => {
  const calls: string[] = []
  listThenSelect(
    () => calls.push("add"),
    () => calls.push("select")
  )
  expect(calls).toEqual(["add", "select"])
})

// Repo'da DOM test ortamı yok: davranışın kanıtı #884'ün tarayıcı QA'sıdır.
// Sıra testi flushSync'siz (asıl hatalı) uygulamayı da geçirir, o yüzden
// kaynak taraması flushSync'in yerinde durduğunu sabitler.
test("listThenSelect seçeneği flushSync ile işler (#884)", () => {
  const src = readFileSync(join(import.meta.dir, "list-then-select.ts"), "utf8")
  expect(src).toContain("flushSync(addOption)")
})

test("randevu formu yeni aracı listThenSelect ile seçer (#884)", () => {
  const form = readFileSync(
    join(import.meta.dir, "..", "..", "components", "appointments", "appointment-create-form.tsx"),
    "utf8"
  )
  expect(form).toContain("listThenSelect(")
})
