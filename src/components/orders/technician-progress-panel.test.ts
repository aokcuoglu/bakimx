import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { formatMinutes } from "@/lib/format"

const SOURCE = readFileSync(join(import.meta.dir, "technician-progress-panel.tsx"), "utf8")

/**
 * #200: teknisyen blokları iş emri ekranına SALT OKUNUR taşındı. Kontrol listesi
 * kanıt niteliğinde — işi yapan teknisyen işaretlemeli, yoksa "kim doğruladı"
 * sorusunun cevabı kaybolur. Buraya yanlışlıkla bir aksiyon eklenmesi ne
 * TypeScript'e ne lint'e takılır; bu yüzden sözleşmeyi kaynak üzerinden korur.
 */

test("panel hiçbir server action'ı import etmez", () => {
  const imports = [...SOURCE.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1])
  const actionImports = imports.filter((p) => p.includes("action"))
  expect(actionImports).toEqual([])
})

test("panelde etkileşimli öğe yok", () => {
  for (const pattern of [/onClick/, /onChange/, /onValueChange/, /<button/, /<Button/, /<form/, /<Input/, /<Checkbox/]) {
    expect(SOURCE).not.toMatch(pattern)
  }
})

test("panel istemci durumu tutmaz (useState/useTransition yok)", () => {
  expect(SOURCE).not.toMatch(/useState|useTransition|useEffect/)
})

test("süre biçimi saat eşiğini doğru geçer", () => {
  expect(formatMinutes(0)).toBe("0dk")
  expect(formatMinutes(45)).toBe("45dk")
  expect(formatMinutes(59)).toBe("59dk")
  expect(formatMinutes(60)).toBe("1s 0dk")
  expect(formatMinutes(135)).toBe("2s 15dk")
  expect(formatMinutes(600)).toBe("10s 0dk")
})
