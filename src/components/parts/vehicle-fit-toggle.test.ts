import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { VehicleFitToggle, vehicleFitSummary } from "./vehicle-fit-toggle"

/**
 * #760: "Yalnız bu araca uyanlar" düğmesinin açık/kapalı durumu görünür olmalı —
 * app-dev'de tıklandığında (tüm satırlar zaten uyumluyken) hiçbir şey değişmiyor,
 * kullanıcı süzgecin açık olup olmadığını anlayamıyordu.
 */
function render(pressed: boolean, fitting = 31, total = 40) {
  return renderToStaticMarkup(
    createElement(VehicleFitToggle, { pressed, onPressedChange: () => {}, fitting, total }),
  )
}

describe("VehicleFitToggle", () => {
  test("kapalıyken aria-pressed=false, araç ikonu ve 'tümü gösteriliyor'", () => {
    const html = render(false)
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('data-state="off"')
    expect(html).toContain("lucide-car-front")
    expect(html).not.toContain("lucide-check")
    expect(html).toContain("31 parça bu araca uyumlu · tümü gösteriliyor")
  })

  test("açıkken aria-pressed=true, dolu birincil görünüm, onay ikonu ve sayaç", () => {
    const html = render(true)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('data-state="on"')
    expect(html).toContain("data-[state=on]:bg-primary/10")
    expect(html).toContain("data-[state=on]:text-primary-strong")
    expect(html).toContain("lucide-check")
    expect(html).not.toContain("lucide-car-front")
    expect(html).toContain("Yalnız uyanlar gösteriliyor · 31/40")
  })

  test("hiçbir satır gizlenmese de açık süzgeç etkin olduğunu söyler", () => {
    const html = render(true, 12, 12)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain("Yalnız uyanlar gösteriliyor · 12/12")
  })
})

describe("vehicleFitSummary", () => {
  test("kaynak adıyla sayım metni", () => {
    expect(vehicleFitSummary({ active: false, fitting: 3, total: 9, noun: "GetirBakım ürünü" }))
      .toBe("3 GetirBakım ürünü bu araca uyumlu · tümü gösteriliyor")
    expect(vehicleFitSummary({ active: true, fitting: 3, total: 9 })).toBe("Yalnız uyanlar gösteriliyor · 3/9")
  })
})

test("iki yüzey de (satır içi arama + parça seçici) ortak düğmeyi kullanır, varsayılan kapalı", async () => {
  for (const file of ["./part-search-input.tsx", "./tecdoc-search-results.tsx"]) {
    const source = await Bun.file(new URL(file, import.meta.url)).text()
    expect(source).toContain("<VehicleFitToggle")
    expect(source).toContain("useState(false)")
    expect(source).not.toContain("<Toggle")
  }
})
