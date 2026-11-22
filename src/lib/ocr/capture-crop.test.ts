import { describe, expect, test } from "bun:test"
import { coverRegionToSource } from "./capture-crop"

const box = { left: 0, top: 64, width: 400, height: 700 }

describe("coverRegionToSource", () => {
  test("yatay kamera + dikey ekran: yalnız görünen orta dilim çekilir (tüm kare değil)", () => {
    const crop = coverRegionToSource({ width: 1920, height: 1080 }, box, box)
    // Yükseklik tamamen görünür, genişliğin yalnız ortası.
    expect(crop.sy).toBe(0)
    expect(crop.sHeight).toBeCloseTo(1080)
    expect(crop.sWidth).toBeCloseTo((400 / 700) * 1080)
    expect(crop.sx).toBeCloseTo((1920 - crop.sWidth) / 2)
    // Çekilen karenin oranı önizleme kutusunun oranıyla aynı.
    expect(crop.sWidth / crop.sHeight).toBeCloseTo(400 / 700)
  })

  test("kaynak oranı kutuyla aynıysa tüm kare", () => {
    const crop = coverRegionToSource({ width: 800, height: 1400 }, box, box)
    expect(crop).toEqual({ sx: 0, sy: 0, sWidth: 800, sHeight: 1400 })
  })

  test("rehber çerçevesi: yalnız çerçeve içi + hizalama payı", () => {
    const source = { width: 800, height: 1400 } // ölçek 0.5
    const frame = { left: 100, top: 64 + 300, width: 200, height: 50 }
    const crop = coverRegionToSource(source, box, frame, { x: 0.1, y: 0.2 })
    expect(crop.sx).toBeCloseTo(200 - 40)
    expect(crop.sy).toBeCloseTo(600 - 20)
    expect(crop.sWidth).toBeCloseTo(400 + 80)
    expect(crop.sHeight).toBeCloseTo(100 + 40)
  })

  test("kaynak sınırına kıstırılır", () => {
    const crop = coverRegionToSource({ width: 800, height: 1400 }, box, box, { x: 0.5, y: 0.5 })
    expect(crop.sx).toBe(0)
    expect(crop.sy).toBe(0)
    expect(crop.sWidth).toBe(800)
    expect(crop.sHeight).toBe(1400)
  })

  test("ölçülemeyen kutu: güvenli yedek olarak tüm kare", () => {
    const crop = coverRegionToSource({ width: 1920, height: 1080 }, { left: 0, top: 0, width: 0, height: 0 }, box)
    expect(crop).toEqual({ sx: 0, sy: 0, sWidth: 1920, sHeight: 1080 })
  })
})
