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

/**
 * #913 — teslim edilmiş / iptal kabulde işaretlenmemiş madde "bekliyor" diye
 * okunmaz (bekleyen bir iş kalmadı); panel yine aksiyonsuz.
 */
test("kapanmış kabulde işaretlenmemiş madde 'bekliyor' değil 'işaretlenmedi' okunur", async () => {
  const { createElement } = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { TechnicianProgressPanel } = await import("./technician-progress-panel")
  const item = {
    id: "c1",
    category: "inspection",
    description: "Fren kontrolü",
    isCompleted: false,
    isRequired: true,
    completedAt: null,
    note: null,
  }
  const render = (closed: boolean) =>
    renderToStaticMarkup(
      createElement(TechnicianProgressPanel, { checklistItems: [item], laborSessions: [], internalNotes: [], closed }),
    )

  const open = render(false)
  expect(open).toContain(" — bekliyor")
  expect(open).toContain("Henüz işçilik kaydı yok")

  const closed = render(true)
  expect(closed).toContain(" — işaretlenmedi")
  expect(closed).not.toContain("bekliyor")
  expect(closed).not.toContain("Henüz")
  // Başlık hapı ilerleme değil kayıt; hiç işaretlenmemiş grupta "0/1" sayacı yok.
  expect(open).toContain("0 / 1 tamamlandı")
  expect(open).toContain("0/1")
  expect(closed).not.toContain("tamamlandı")
  expect(closed).toContain("0 / 1 işaretlendi")
  expect(closed).not.toContain("0/1")
})

test("kapanmış kabulde işaretlenmiş grubun sayacı kalır, madde yoksa hap çizilmez", async () => {
  const { createElement } = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { TechnicianProgressPanel } = await import("./technician-progress-panel")
  const item = (id: string, isCompleted: boolean) => ({
    id,
    category: "repair",
    description: `Madde ${id}`,
    isCompleted,
    isRequired: true,
    completedAt: null,
    note: null,
  })
  const partial = renderToStaticMarkup(
    createElement(TechnicianProgressPanel, {
      checklistItems: [item("a", true), item("b", false)],
      laborSessions: [],
      internalNotes: [],
      closed: true,
    }),
  )
  expect(partial).toContain("1/2")
  expect(partial).toContain("1 / 2 işaretlendi")
  const empty = renderToStaticMarkup(
    createElement(TechnicianProgressPanel, { checklistItems: [], laborSessions: [], internalNotes: [], closed: true }),
  )
  expect(empty).not.toContain("işaretlendi")
  expect(empty).toContain("Kontrol maddesi yok")
})
