// Ruhsat tarayıcı için saf, DOM/CV bağımsız karar mantığı.
// jscanify getCornerPoints çıktısıyla aynı köşe adlarını kullanır.

export type Point = { x: number; y: number }

export type CornerPoints = {
  topLeftCorner: Point
  topRightCorner: Point
  bottomRightCorner: Point
  bottomLeftCorner: Point
}

export type AutoCaptureConstants = {
  fillMin: number
  edgeMargin: number
  stableFrames: number
  stabilityEps: number
  sharpMin: number
}

export const DEFAULT_AUTO_CAPTURE: AutoCaptureConstants = {
  fillMin: 0.55,
  edgeMargin: 0.015,
  stableFrames: 6,
  stabilityEps: 6,
  sharpMin: 100,
}

export type AutoCaptureReason =
  | "ready"
  | "no-document"
  | "too-small"
  | "clipped"
  | "blurry"
  | "unstable"

export type AutoCaptureResult = { ready: boolean; reason: AutoCaptureReason }

export type AutoCaptureInput = {
  corners: CornerPoints | null
  frameWidth: number
  frameHeight: number
  history: CornerPoints[]
  blurScore: number
  constants?: AutoCaptureConstants
}

function cornerArray(c: CornerPoints): Point[] {
  return [c.topLeftCorner, c.topRightCorner, c.bottomRightCorner, c.bottomLeftCorner]
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Shoelace formülü (TL -> TR -> BR -> BL sırası).
export function quadArea(c: CornerPoints): number {
  const pts = cornerArray(c)
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    sum += p.x * q.y - q.x * p.y
  }
  return Math.abs(sum) / 2
}

export function fillRatio(c: CornerPoints, frameWidth: number, frameHeight: number): number {
  if (frameWidth <= 0 || frameHeight <= 0) return 0
  return quadArea(c) / (frameWidth * frameHeight)
}

export function isWithinBounds(
  c: CornerPoints,
  frameWidth: number,
  frameHeight: number,
  margin: number,
): boolean {
  const minX = frameWidth * margin
  const maxX = frameWidth * (1 - margin)
  const minY = frameHeight * margin
  const maxY = frameHeight * (1 - margin)
  return cornerArray(c).every(
    (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
  )
}

function maxCornerMovement(a: CornerPoints, b: CornerPoints): number {
  const pa = cornerArray(a)
  const pb = cornerArray(b)
  let max = 0
  for (let i = 0; i < pa.length; i++) {
    max = Math.max(max, dist(pa[i], pb[i]))
  }
  return max
}

// Son `stableFrames` karede ardışık köşe hareketi `eps` pikselden azsa kararlı.
export function isStable(history: CornerPoints[], stableFrames: number, eps: number): boolean {
  if (history.length < stableFrames) return false
  const recent = history.slice(history.length - stableFrames)
  for (let i = 1; i < recent.length; i++) {
    if (maxCornerMovement(recent[i - 1], recent[i]) >= eps) return false
  }
  return true
}

// Tespit edilen dörtgenin gerçek oranını koruyarak uzun kenarı `longEdge`'e ölçekler.
export function computeExtractSize(c: CornerPoints, longEdge: number): { width: number; height: number } {
  const topW = dist(c.topLeftCorner, c.topRightCorner)
  const bottomW = dist(c.bottomLeftCorner, c.bottomRightCorner)
  const leftH = dist(c.topLeftCorner, c.bottomLeftCorner)
  const rightH = dist(c.topRightCorner, c.bottomRightCorner)
  const w = (topW + bottomW) / 2
  const h = (leftH + rightH) / 2
  if (w <= 0 || h <= 0) return { width: longEdge, height: longEdge }
  const scale = longEdge / Math.max(w, h)
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

export function shouldAutoCapture(input: AutoCaptureInput): AutoCaptureResult {
  const k = input.constants ?? DEFAULT_AUTO_CAPTURE
  const { corners, frameWidth, frameHeight, history, blurScore } = input

  if (!corners) return { ready: false, reason: "no-document" }
  if (fillRatio(corners, frameWidth, frameHeight) < k.fillMin) {
    return { ready: false, reason: "too-small" }
  }
  if (!isWithinBounds(corners, frameWidth, frameHeight, k.edgeMargin)) {
    return { ready: false, reason: "clipped" }
  }
  if (blurScore < k.sharpMin) return { ready: false, reason: "blurry" }
  if (!isStable(history, k.stableFrames, k.stabilityEps)) {
    return { ready: false, reason: "unstable" }
  }
  return { ready: true, reason: "ready" }
}
