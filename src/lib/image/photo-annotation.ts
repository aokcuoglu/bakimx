import { z } from "zod"

/** Version 1 stores every coordinate as a fraction of the oriented source image. */
export type AnnotationTool = "pen" | "arrow" | "rect" | "ellipse"
export interface PhotoAnnotationShape {
  id: string
  tool: AnnotationTool
  color: string
  strokeWidth: number
  points: number[]
}
export interface PhotoAnnotationDocument { version: 1; shapes: PhotoAnnotationShape[] }
export interface AnnotationHistory { past: PhotoAnnotationShape[][]; present: PhotoAnnotationShape[]; future: PhotoAnnotationShape[][] }
export const emptyAnnotation = (): PhotoAnnotationDocument => ({ version: 1, shapes: [] })
export function normalizedPoint(x: number, y: number, width: number, height: number): number[] {
  return [Math.max(0, Math.min(1, x / width)), Math.max(0, Math.min(1, y / height))]
}
export function transformAnnotation(shape: PhotoAnnotationShape, dx: number, dy: number, sx = 1, sy = 1): PhotoAnnotationShape {
  return { ...shape, points: shape.points.map((p, i) => Math.max(0, Math.min(1, p * (i % 2 ? sy : sx) + (i % 2 ? dy : dx)))) }
}
export function annotationHistory(state: AnnotationHistory, action: { type: "set"; shapes: PhotoAnnotationShape[] } | { type: "undo" | "redo" }): AnnotationHistory {
  if (action.type === "set") return { past: [...state.past.slice(-49), state.present], present: action.shapes, future: [] }
  if (action.type === "undo" && state.past.length) return { past: state.past.slice(0, -1), present: state.past.at(-1)!, future: [state.present, ...state.future] }
  if (action.type === "redo" && state.future.length) return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) }
  return state
}

export const photoAnnotationDocumentSchema = z.object({
  version: z.literal(1),
  shapes: z.array(z.object({
    id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
    tool: z.enum(["pen", "arrow", "rect", "ellipse"]),
    color: z.string().max(100).regex(/^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|oklch|color)\([0-9a-zA-Z.,% /+-]+\))$/),
    strokeWidth: z.number().finite().min(0.0001).max(0.1),
    points: z.array(z.number().finite().min(0).max(1)).min(4).max(20000),
  }).strict().superRefine((shape, ctx) => {
    if (shape.points.length % 2 || (shape.tool !== "pen" && shape.points.length !== 4)) ctx.addIssue({ code: "custom", message: "Geçersiz çizim koordinatları" })
  })).max(200),
}).strict().superRefine((doc, ctx) => {
  if (new Set(doc.shapes.map(s => s.id)).size !== doc.shapes.length) ctx.addIssue({ code: "custom", message: "Çizim kimlikleri benzersiz olmalı" })
})
