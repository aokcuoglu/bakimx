import { describe, expect, test } from "bun:test"
import { annotationHistory, normalizedPoint, photoAnnotationDocumentSchema, transformAnnotation, type PhotoAnnotationShape } from "./photo-annotation"
const shape: PhotoAnnotationShape = { id: "one", tool: "arrow", points: [0.1, 0.2, 0.5, 0.6], color: "#ff0000", strokeWidth: 0.004 }
describe("photo annotations", () => {
  test("touch coordinates survive viewport and zoom changes", () => {
    expect(normalizedPoint(50, 80, 100, 200)).toEqual(normalizedPoint(500, 800, 1000, 2000))
    expect(normalizedPoint(-1, 500, 100, 200)).toEqual([0, 1])
  })
  test("drag and resize operate in source fractions without mutating saved shapes", () => {
    expect(transformAnnotation(shape, 0.1, 0.1, 2, 1).points).toEqual([0.30000000000000004, 0.30000000000000004, 1, 0.7])
    expect(shape.points).toEqual([0.1, 0.2, 0.5, 0.6])
  })
  test("undo restores removed shapes; a new edit discards redo history", () => {
    const initial = { past: [], present: [shape], future: [] }
    const deleted = annotationHistory(initial, { type: "set", shapes: [] })
    const undone = annotationHistory(deleted, { type: "undo" })
    expect(undone.present).toEqual([shape])
    expect(annotationHistory(undone, { type: "redo" }).present).toEqual([])
    const branch = annotationHistory(undone, { type: "set", shapes: [transformAnnotation(shape, 0.1, 0)] })
    expect(annotationHistory(branch, { type: "redo" })).toEqual(branch)
  })
  test("stored document reopens unchanged and rejects malformed or unbounded shapes", () => {
    const doc = { version: 1, shapes: [shape] }
    expect(photoAnnotationDocumentSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
    for (const bad of [ { ...shape, points: [0, 1, 2, 3] }, { ...shape, points: [0, 1, 0] }, { ...shape, color: "url(https://example.com)" } ]) {
      expect(photoAnnotationDocumentSchema.safeParse({ version: 1, shapes: [bad] }).success).toBe(false)
    }
    expect(photoAnnotationDocumentSchema.safeParse({ version: 2, shapes: [shape] }).success).toBe(false)
    expect(photoAnnotationDocumentSchema.safeParse({ version: 1, shapes: [shape, shape] }).success).toBe(false)
  })
})
