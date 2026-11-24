import { expect, test } from "bun:test"
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
