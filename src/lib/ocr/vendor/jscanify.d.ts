// Type surface for the vendored jscanify client build (./jscanify.js).
type JScanifyPoint = { x: number; y: number }
declare class Jscanify {
  constructor()
  highlightPaper(
    canvas: HTMLCanvasElement | HTMLImageElement,
    options?: { color?: string; thickness?: number },
  ): HTMLCanvasElement
  findPaperContour(img: unknown): unknown | null
  getCornerPoints(contour: unknown): {
    topLeftCorner: JScanifyPoint
    topRightCorner: JScanifyPoint
    bottomLeftCorner: JScanifyPoint
    bottomRightCorner: JScanifyPoint
  }
  extractPaper(
    image: HTMLCanvasElement | HTMLImageElement,
    resultWidth: number,
    resultHeight: number,
    cornerPoints?: unknown,
  ): HTMLCanvasElement
}
export default Jscanify
