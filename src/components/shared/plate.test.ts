import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Plate, type PlateSize } from "./plate"

/**
 * `bun test` CSS module sınıf adlarını çözmez; bu yüzden sınıfa değil, stilin
 * bağlandığı `data-*` niteliklerine ve metne bakılır (#818).
 */
const render = (props: { plate: string; size?: PlateSize }) => renderToStaticMarkup(createElement(Plate, props))

test("TR plakası bugünkü gibi: ülke metni yok", () => {
  const html = render({ plate: "34MHP923" })
  expect(html).toContain('data-plate-country="TR"')
  expect(html).toContain("34 MHP 923")
  expect(html).not.toContain("plakası")
  expect(html).not.toContain("data-size")
})

test("yabancı plaka bantta kodu, ekran okuyucuya ülke adını verir", () => {
  const html = render({ plate: "MAB1234", size: "lg" })
  expect(html).toContain('data-plate-country="D"')
  expect(html).toContain('data-size="lg"')
  expect(html).toMatch(/aria-hidden="true"[^>]*>D</)
  expect(html).toContain('<span class="sr-only">Almanya plakası </span>')
  expect(html).toContain("MAB 1234")
})

/**
 * D, UK ve BG'de ülkeyi gösteren TEK görsel işaret banttaki koddur. Kaldırılan
 * `PlateBadge`, "TR" yazısını sm'de 8px, md'de 9px çiziyordu; yeni bant bu
 * tabanın altına inmesin (#818 tasarım incelemesi).
 */
test("banttaki ülke kodu eski PlateBadge boylarının altına inmez", () => {
  const css = readFileSync(join(import.meta.dir, "plate.module.css"), "utf8")
  const sizes = [...css.matchAll(/\.band\s*\{[^}]*?font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
  expect(sizes.sort((a, b) => a - b)).toEqual([8, 9, 10.5])
})
