import { expect, test, describe } from "bun:test"
import {
  quadArea,
  fillRatio,
  isWithinBounds,
  isStable,
  computeExtractSize,
  shouldAutoCapture,
  DEFAULT_AUTO_CAPTURE,
  type CornerPoints,
} from "@/lib/ocr/document-detection"

// Eksenlere hizalı dikdörtgen köşe seti üretici.
function rect(x: number, y: number, w: number, h: number): CornerPoints {
  return {
    topLeftCorner: { x, y },
    topRightCorner: { x: x + w, y },
    bottomRightCorner: { x: x + w, y: y + h },
    bottomLeftCorner: { x, y: y + h },
  }
}

describe("geometri", () => {
  test("quadArea birim dikdörtgeni doğru hesaplar", () => {
    expect(quadArea(rect(0, 0, 100, 50))).toBe(5000)
  })

  test("fillRatio = dörtgen alanı / kare alanı", () => {
    // 200x100 dörtgen, 400x200 kare => 20000 / 80000 = 0.25
    expect(fillRatio(rect(0, 0, 200, 100), 400, 200)).toBeCloseTo(0.25, 5)
  })

  test("isWithinBounds kenara yapışık dörtgeni reddeder", () => {
    // margin %1.5 => x ekseninde izinli alan [6, 394] (400 px)
    expect(isWithinBounds(rect(10, 10, 380, 180), 400, 200, 0.015)).toBe(true)
    expect(isWithinBounds(rect(0, 10, 380, 180), 400, 200, 0.015)).toBe(false) // sol kenar 0 < 6
  })

  test("computeExtractSize oranı korur ve uzun kenarı hedefe ölçekler", () => {
    const size = computeExtractSize(rect(0, 0, 300, 150), 1600)
    expect(size.width).toBe(1600)
    expect(size.height).toBe(800)
  })
})

describe("isStable", () => {
  const stable = Array.from({ length: 6 }, () => rect(10, 10, 380, 180))

  test("yeterli sabit kare varsa true", () => {
    expect(isStable(stable, 6, 6)).toBe(true)
  })

  test("yetersiz kare sayısında false", () => {
    expect(isStable(stable.slice(0, 3), 6, 6)).toBe(false)
  })

  test("son karelerde büyük hareket varsa false", () => {
    const jittery = [...stable.slice(0, 5), rect(40, 40, 380, 180)] // son kare 30px+ kaydı
    expect(isStable(jittery, 6, 6)).toBe(false)
  })
})

describe("shouldAutoCapture", () => {
  const frameW = 480
  const frameH = 300
  // Kareyi iyi dolduran, ortalanmış, kesilmemiş dörtgen.
  const good = rect(20, 15, 440, 270) // fill ~ (440*270)/(480*300)=0.825
  const goodHistory = Array.from({ length: 6 }, () => good)

  test("belge yoksa no-document", () => {
    const r = shouldAutoCapture({ corners: null, frameWidth: frameW, frameHeight: frameH, history: [], blurScore: 500 })
    expect(r).toEqual({ ready: false, reason: "no-document" })
  })

  test("küçük belge too-small", () => {
    const small = rect(20, 15, 150, 90) // fill ~0.09
    const r = shouldAutoCapture({ corners: small, frameWidth: frameW, frameHeight: frameH, history: Array(6).fill(small), blurScore: 500 })
    expect(r.reason).toBe("too-small")
    expect(r.ready).toBe(false)
  })

  test("kenara taşan belge clipped", () => {
    const clipped = rect(0, 15, 460, 270)
    const r = shouldAutoCapture({ corners: clipped, frameWidth: frameW, frameHeight: frameH, history: Array(6).fill(clipped), blurScore: 500 })
    expect(r.reason).toBe("clipped")
  })

  test("bulanık kare blurry", () => {
    const r = shouldAutoCapture({ corners: good, frameWidth: frameW, frameHeight: frameH, history: goodHistory, blurScore: 10 })
    expect(r.reason).toBe("blurry")
  })

  test("oynak kare unstable", () => {
    const jittery = [...Array(5).fill(good), rect(60, 50, 440, 270)]
    const r = shouldAutoCapture({ corners: good, frameWidth: frameW, frameHeight: frameH, history: jittery, blurScore: 500 })
    expect(r.reason).toBe("unstable")
  })

  test("tüm koşullar sağlanınca ready", () => {
    const r = shouldAutoCapture({ corners: good, frameWidth: frameW, frameHeight: frameH, history: goodHistory, blurScore: 500 })
    expect(r).toEqual({ ready: true, reason: "ready" })
  })

  test("computeExtractSize sıfır boyutlu girdi → longEdge×longEdge döndürür", () => {
    expect(computeExtractSize(rect(0, 0, 0, 0), 1600)).toEqual({ width: 1600, height: 1600 })
  })

  test("isWithinBounds tam üst sınırda (<=) true döndürür", () => {
    // frameWidth=400, frameHeight=200, margin=0.015
    // minX=6, maxX=394, minY=3, maxY=197
    // rect(6, 3, 388, 194) → sağ kenar=394, alt kenar=197 — tam sınırda.
    expect(isWithinBounds(rect(6, 3, 388, 194), 400, 200, 0.015)).toBe(true)
  })

  test("DEFAULT_AUTO_CAPTURE beklenen eşikleri taşır", () => {
    expect(DEFAULT_AUTO_CAPTURE.fillMin).toBe(0.55)
    expect(DEFAULT_AUTO_CAPTURE.stableFrames).toBe(6)
    expect(DEFAULT_AUTO_CAPTURE.edgeMargin).toBe(0.015)
    expect(DEFAULT_AUTO_CAPTURE.stabilityEps).toBe(6)
    expect(DEFAULT_AUTO_CAPTURE.sharpMin).toBe(100)
  })
})
