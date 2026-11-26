import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/app/admin/admin-requests.tsx"),
  "utf8"
)

function slice(startMarker: string, endMarker: string): string {
  const start = SOURCE.indexOf(startMarker)
  expect(start).toBeGreaterThan(-1)
  const end = SOURCE.indexOf(endMarker, start)
  return SOURCE.slice(start, end === -1 ? undefined : end)
}

const supportRequestRow = () =>
  slice("function SupportRequestRow(", "export function AdminSupportRequests(")
const adminSupportRequests = () => slice("export function AdminSupportRequests(", "\n}\n")

// #926: destek talebi satırı elle yazılmış açılır düğme değil, `card`
// akordeonun öğesidir. Açık/kapalı durumu ve aria-expanded Radix'ten gelir;
// tetikleyici yüksekliği akordeonun `--control-h` tabanından.
test("destek talebi satırı kart akordeon öğesidir", () => {
  const row = supportRequestRow()

  expect(row).toContain("<AccordionItem value={r.id}")
  expect(row).toContain("<AccordionTrigger")
  expect(row).toContain("<AccordionContent>")
  // Elle tutulan açık/kapalı durumu ve elle yazılan aria-expanded kalmadı.
  expect(row).not.toMatch(/\saria-expanded=/)
  expect(row).not.toMatch(/\[expanded, setExpanded\]/)
  expect(row).not.toContain('size="row"')
  // Kapalıyken mesaj önizlemesi, açılınca tetikleyicinin durumuyla gizlenir.
  expect(row).toContain("group-aria-expanded/accordion-trigger:hidden")

  expect(adminSupportRequests()).toContain('<Accordion type="multiple" variant="card"')
})
