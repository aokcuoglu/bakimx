"use client"

import { useEffect, useRef, useState, useReducer } from "react"
import { Stage, Layer, Image as KonvaImage, Line, Arrow, Rect, Ellipse, Transformer } from "react-konva"
import type Konva from "konva"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { annotationHistory, emptyAnnotation, normalizedPoint, transformAnnotation, type AnnotationTool, type PhotoAnnotationDocument, type PhotoAnnotationShape } from "@/lib/image/photo-annotation"

export interface PhotoEditorProps {
  sourceUrl: string
  initialAnnotation?: PhotoAnnotationDocument
  onSave: (result: { annotation: PhotoAnnotationDocument; derivative: Blob }) => Promise<void>
  onCancel: () => void
}
const toolLabels = { select: "Seç / taşı", arrow: "Ok", ellipse: "Daire", rect: "Dikdörtgen", pen: "Kalem" } as const

export default function PhotoEditor({ sourceUrl, initialAnnotation, onSave, onCancel }: PhotoEditorProps) {
  const [history, dispatch] = useReducer(annotationHistory, { past: [], present: (initialAnnotation ?? emptyAnnotation()).shapes, future: [] })
  const [tool, setTool] = useState<AnnotationTool | "select">("arrow")
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<PhotoAnnotationShape | null>(null)
  const draftRef = useRef<PhotoAnnotationShape | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [width, setWidth] = useState(600)
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [stroke, setStroke] = useState("black")
  const container = useRef<HTMLDivElement>(null)
  const stage = useRef<Konva.Stage>(null)
  const transformer = useRef<Konva.Transformer>(null)
  const [baseline, setBaseline] = useState(JSON.stringify(history.present))
  const dirty = JSON.stringify(history.present) !== baseline
  useEffect(() => {
    const image = new window.Image()
    image.onload = () => setImg(image)
    image.onerror = () => setError("Fotoğraf yüklenemedi. Yeniden açmayı deneyin.")
    image.src = sourceUrl
    return () => { image.onload = null; image.onerror = null }
  }, [sourceUrl])
  useEffect(() => {
    const el = container.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(Math.max(200, el.clientWidth)))
    observer.observe(el)
    // Resolve a CSS theme token into a canvas-supported color; annotation color persists.
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const token = getComputedStyle(el).getPropertyValue("--destructive").trim()
    if (ctx && token) {
      ctx.fillStyle = token; ctx.fillRect(0, 0, 1, 1)
      const [red, green, blue] = ctx.getImageData(0, 0, 1, 1).data
      setStroke(`rgb(${red}, ${green}, ${blue})`)
    }
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  useEffect(() => {
    const node = selected ? stage.current?.findOne(`#${selected}`) : null
    transformer.current?.nodes(node ? [node] : [])
  }, [selected, history.present, tool])
  const w = Math.min(width, img?.naturalWidth ?? width) * zoom
  const h = img ? w * img.naturalHeight / img.naturalWidth : 300
  function point() {
    const pos = stage.current?.getPointerPosition()
    return pos ? normalizedPoint(pos.x, pos.y, w, h) : null
  }
  function start() {
    if (busy || tool === "select") return
    if (history.present.length >= 200) { setError("En fazla 200 çizim eklenebilir."); return }
    const p = point()
    if (!p) return
    const value: PhotoAnnotationShape = { id: `s${crypto.randomUUID()}`, tool, color: stroke, strokeWidth: 0.004, points: [...p, ...p] }
    draftRef.current = value; setDraft(value); setSelected(null)
  }
  function move() {
    const current = draftRef.current, p = point()
    if (!current || !p || current.points.length >= 20000) return
    const value = { ...current, points: current.tool === "pen" ? [...current.points, ...p] : [...current.points.slice(0, 2), ...p] }
    draftRef.current = value; setDraft(value)
  }
  function finish() {
    const value = draftRef.current
    if (value && (value.points.length > 4 || value.points[0] !== value.points[2] || value.points[1] !== value.points[3])) dispatch({ type: "set", shapes: [...history.present, value] })
    draftRef.current = null; setDraft(null)
  }
  function update(shape: PhotoAnnotationShape, node: Konva.Node) {
    const next = transformAnnotation(shape, node.x() / w, node.y() / h, node.scaleX(), node.scaleY())
    node.position({ x: 0, y: 0 }); node.scale({ x: 1, y: 1 })
    dispatch({ type: "set", shapes: history.present.map(s => s.id === shape.id ? next : s) })
  }
  function remove() { dispatch({ type: "set", shapes: history.present.filter(s => s.id !== selected) }); setSelected(null) }
  async function save() {
    if (!stage.current || !img) return
    setBusy(true); setError("")
    try {
      transformer.current?.nodes([])
      const blob = await stage.current.toBlob({ mimeType: "image/jpeg", quality: 0.85, pixelRatio: img.naturalWidth / w })
      if (!(blob instanceof Blob)) throw new Error("Görsel oluşturulamadı")
      await onSave({ annotation: { version: 1, shapes: history.present }, derivative: blob })
      setBaseline(JSON.stringify(history.present))
    } catch (e) { setError(e instanceof Error ? e.message : "Kaydedilemedi. Çizimler korundu; tekrar deneyebilirsiniz.") }
    finally { setBusy(false); setSelected(null) }
  }
  const allShapes = draft ? [...history.present, draft] : history.present
  return <div className="min-w-0 max-w-full space-y-3" ref={container}>
    <ToggleGroup className="flex-wrap" type="single" value={tool} onValueChange={value => { if (value) { setTool(value as typeof tool); setSelected(null) } }} aria-label="Çizim aracı" disabled={busy}>
      {Object.entries(toolLabels).map(([value, label]) => <ToggleGroupItem key={value} value={value} aria-label={label}>{label}</ToggleGroupItem>)}
    </ToggleGroup>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={busy || !history.past.length} onClick={() => dispatch({ type: "undo" })}>Geri al</Button>
      <Button type="button" variant="outline" disabled={busy || !history.future.length} onClick={() => dispatch({ type: "redo" })}>İleri al</Button>
      <Button type="button" variant="outline" disabled={busy || !selected} onClick={remove}>Seçileni sil</Button>
      <Button type="button" variant="outline" disabled={zoom <= 0.5} onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} aria-label="Uzaklaştır">−</Button>
      <span className="self-center text-sm">%{Math.round(zoom * 100)}</span>
      <Button type="button" variant="outline" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3, z + 0.25))} aria-label="Yakınlaştır">+</Button>
    </div>
    <p className="text-xs text-muted-foreground">Seç aracında çizime dokunun; köşelerinden boyutlandırın. Klavyeyle aşağıdaki çizim listesinden seçim yapabilirsiniz.</p>
    <div className="max-h-[60vh] w-full min-w-0 overflow-auto rounded-md border bg-muted" style={{ touchAction: tool === "select" ? "auto" : "none" }}>
      {img ? <Stage ref={stage} width={w} height={h} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerLeave={finish}>
        <Layer>
          <KonvaImage image={img} width={w} height={h} onClick={() => setSelected(null)} />
          {allShapes.map(shape => {
            const points = shape.points.map((p, i) => p * (i % 2 ? h : w))
            const common = { id: shape.id, stroke: shape.color, strokeWidth: shape.strokeWidth * w, hitStrokeWidth: 20, draggable: tool === "select" && !busy, onClick: () => tool === "select" && setSelected(shape.id), onTap: () => tool === "select" && setSelected(shape.id), onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => update(shape, e.target), onTransformEnd: (e: Konva.KonvaEventObject<Event>) => update(shape, e.target) }
            if (shape.tool === "pen") return <Line key={shape.id} {...common} points={points} lineCap="round" lineJoin="round" />
            if (shape.tool === "arrow") return <Arrow key={shape.id} {...common} points={points} fill={shape.color} pointerLength={12} pointerWidth={12} />
            // Offset geometry keeps the node transform separate from normalized points.
            const x = Math.min(points[0], points[2]), y = Math.min(points[1], points[3]), sw = Math.abs(points[2] - points[0]), sh = Math.abs(points[3] - points[1])
            if (shape.tool === "rect") return <Rect key={shape.id} {...common} offsetX={-x} offsetY={-y} width={sw} height={sh} />
            return <Ellipse key={shape.id} {...common} offsetX={-x - sw / 2} offsetY={-y - sh / 2} radiusX={sw / 2} radiusY={sh / 2} />
          })}
          {tool === "select" && <Transformer ref={transformer} rotateEnabled={false} flipEnabled={false} />}
        </Layer>
      </Stage> : <p className="p-8">Fotoğraf yükleniyor…</p>}
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Çizimler">
      {history.present.map((shape, i) => <Button key={shape.id} type="button" variant={selected === shape.id ? "secondary" : "outline"} size="sm" onClick={() => { setTool("select"); setSelected(shape.id) }}>Çizim {i + 1}: {toolLabels[shape.tool]}</Button>)}
    </div>
    {selected && <div className="flex flex-wrap gap-2" aria-label="Seçili çizimi taşı">
      {([["Sola", -0.01, 0], ["Sağa", 0.01, 0], ["Yukarı", 0, -0.01], ["Aşağı", 0, 0.01]] as const).map(([label, dx, dy]) => <Button type="button" key={label} variant="outline" size="sm" disabled={busy} onClick={() => dispatch({ type: "set", shapes: history.present.map(s => s.id === selected ? transformAnnotation(s, dx, dy) : s) })}>{label}</Button>)}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => dispatch({ type: "set", shapes: history.present.map(s => s.id === selected ? transformAnnotation(s, 0, 0, 1.05, 1.05) : s) })}>Büyüt</Button>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => dispatch({ type: "set", shapes: history.present.map(s => s.id === selected ? transformAnnotation(s, 0, 0, 0.95, 0.95) : s) })}>Küçült</Button>
    </div>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="flex gap-2">
      <Button type="button" disabled={busy || !img} onClick={save}>{busy ? "Kaydediliyor…" : "Fotoğrafı kaydet"}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm("Kaydedilmemiş çizimler silinsin mi?")) onCancel() }}>Vazgeç</Button>
    </div>
  </div>
}
