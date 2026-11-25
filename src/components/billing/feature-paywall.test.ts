import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime"
import { FEATURE_CATALOG } from "@/lib/feature-catalog"
import type { GatedFeature } from "@/lib/plan"
import { FeaturePaywall } from "./feature-paywall"

function renderAt(pathname: string, feature: GatedFeature) {
  return renderToStaticMarkup(
    createElement(
      PathnameContext.Provider,
      { value: pathname },
      createElement(FeaturePaywall, { feature, currentTier: "trial", itemCount: 3 }),
    ),
  )
}

const h1 = (html: string) => html.match(/<h1[^>]*>([^<]*)<\/h1>/)

describe("FeaturePaywall başlığı (#855)", () => {
  test("kilitli özelliğin kayıt bağlantısında başlık boş kalmaz: özellik adı h1 olur", () => {
    for (const [path, feature] of [
      ["/quotes/q1", "quotes"],
      ["/appointments/a1", "appointments"],
      ["/reminders/r1", "automatedReminders"],
      ["/reminders/r1/edit", "automatedReminders"],
    ] as const) {
      const html = renderAt(path, feature)
      const title = h1(html)
      expect(title).not.toBeNull()
      expect(title![0]).not.toContain("aria-hidden")
      if (path.endsWith("/edit")) {
        expect(title![1]).toBe("Hatırlatmayı Düzenle")
      } else {
        expect(title![1]).toBe(FEATURE_CATALOG[feature].name)
      }
    }
  })

  test("menü sayfasında başlık menü etiketidir", () => {
    expect(h1(renderAt("/quotes", "quotes"))?.[1]).toBe("Teklifler")
  })
})
