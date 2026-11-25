import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { BillingCycleToggle } from "./billing-cycle-toggle"

function names(html: string) {
  return [...html.matchAll(/<button[^>]*role="radio"[^>]*>(.*?)<\/button>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "")
  )
}

test("yıllık radyonun adı etiket ile ipucunu ayraçla okutur", () => {
  const html = renderToStaticMarkup(
    createElement(BillingCycleToggle, {
      value: "monthly",
      onChange: () => {},
      yearlyHint: "%17",
      yearlyHintSrSuffix: " indirim",
    })
  )
  expect(names(html)).toEqual(["Aylık", "Yıllık, %17 indirim"])
})

test("ipucu yoksa yıllık radyo yalnız 'Yıllık' olur", () => {
  const html = renderToStaticMarkup(
    createElement(BillingCycleToggle, { value: "yearly", onChange: () => {} })
  )
  expect(names(html)).toEqual(["Aylık", "Yıllık"])
})
