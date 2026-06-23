// jscanify resmi tip bildirimi sağlamıyorsa kullandığımız yüzeyi daraltıyoruz.
declare module "jscanify/client" {
  type JScanifyPoint = { x: number; y: number }
  export default class jscanify {
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
}
