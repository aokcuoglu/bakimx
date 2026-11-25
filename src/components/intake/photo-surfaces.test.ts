import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (rel: string) => readFileSync(join(process.cwd(), "src/components", rel), "utf8")

describe("#859 foto / hasar yüzeyleri e-santral dilinde", () => {
  test("faz matrisi: kontrol boyutlu sekme, iki sütun, kesikli çerçeve yok", () => {
    const src = read("intake/photo-phase-matrix.tsx")
    expect(src).toContain('<TabsList size="control"')
    expect(src).toContain("grid-cols-2")
    expect(src).not.toContain("border-dashed")
    expect(src).not.toContain("minmax(9.5rem")
  })

  test("galeri: büyük harf MIME yok, iç içe etkileşimli kart yok, çerçeveli kart yok", () => {
    const src = read("intake/photo-gallery-grid.tsx")
    expect(src).not.toContain("uppercase")
    expect(src).not.toContain("role={onOpen")
    expect(src).not.toContain("rounded-lg border")
  })

  test("hasar haritası ve 3B görüntüleyici çerçevesiz", () => {
    const map = read("damage/vehicle-damage-map.tsx")
    const viewer = read("damage/vehicle-3d-viewer.tsx")
    for (const src of [map, viewer]) {
      expect(src).not.toContain("rounded-xl border")
      expect(src).not.toContain("border-dashed")
    }
    expect(map).toContain('size="control"')
  })

  test("e2e sözleşme metinleri yerinde", () => {
    const capture = read("intake/damage-capture.tsx")
    const map = read("damage/vehicle-damage-map.tsx")
    const viewer = read("damage/vehicle-3d-viewer.tsx")
    expect(capture).toContain('data-testid="damage-capture"')
    expect(capture).toContain("Hasar yok olarak işaretle")
    expect(capture).toContain("Hasarı Kaydet")
    expect(map).toContain('aria-label="Hasar görünümü"')
    expect(map).toContain('aria-label="Araç hasar şeması"')
    expect(map).toContain("— hasar ekle")
    expect(map).toContain("data-damage-number")
    expect(viewer).toContain('aria-label="3B araç hasar modeli"')
  })
})
