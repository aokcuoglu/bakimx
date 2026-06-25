"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Camera, Undo2, Trash2 } from "lucide-react"
import { fitDimensions } from "@/lib/image/fit-dimensions"

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85
const STROKE_WIDTH = 4
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#111827", "#ffffff"]

type Point = { x: number; y: number }
type Stroke = { color: string; points: Point[] }
type UploadedPhoto = { id: string; fileUrl: string | null }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load failed")) }
    img.src = url
  })
}

export function PhotoAnnotate({
  intakeFormId,
  label = "Hasar",
  phase = "intake",
  onUploaded,
}: {
  intakeFormId: string
  label?: string
  phase?: string
  onUploaded?: (photo: UploadedPhoto) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef<Stroke | null>(null)
  const dprRef = useRef(1)

  const [hasImage, setHasImage] = useState(false)
  const [color, setColor] = useState(COLORS[0])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [uploaded, setUploaded] = useState<UploadedPhoto[]>([])

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // aynı dosyayı tekrar seçebilmek için
    if (!file) return
    setError("")
    try {
      const img = await loadImage(file)
      const { w, h } = fitDimensions(img.width, img.height, MAX_EDGE)
      if (w === 0 || h === 0) { setError("Görsel okunamadı"); return }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      dprRef.current = dpr
      const base = baseCanvasRef.current!
      const overlay = overlayCanvasRef.current!
      for (const c of [base, overlay]) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
        c.style.width = `${w}px`
        c.style.height = `${h}px`
      }
      const bctx = base.getContext("2d")!
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bctx.clearRect(0, 0, w, h)
      bctx.drawImage(img, 0, 0, w, h)
      const octx = overlay.getContext("2d")!
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
      octx.clearRect(0, 0, w, h)
      strokesRef.current = []
      setHasImage(true)
    } catch {
      setError("Görsel yüklenemedi")
    }
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    // Canvas CSS ile küçülebilir (max-w-full); render boyutunu mantıksal
    // (style.width = w) boyuta ölçekle, yoksa mobilde çizgiler kayar.
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const logicalW = parseFloat(el.style.width) || rect.width
    const logicalH = parseFloat(el.style.height) || rect.height
    const sx = rect.width ? logicalW / rect.width : 1
    const sy = rect.height ? logicalH / rect.height : 1
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasImage) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = { color, points: [pointFromEvent(e)] }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = drawingRef.current
    if (!stroke) return
    const p = pointFromEvent(e)
    const prev = stroke.points[stroke.points.length - 1]
    stroke.points.push(p)
    const octx = overlayCanvasRef.current!.getContext("2d")!
    octx.strokeStyle = stroke.color
    octx.lineWidth = STROKE_WIDTH
    octx.lineCap = "round"
    octx.lineJoin = "round"
    octx.beginPath()
    octx.moveTo(prev.x, prev.y)
    octx.lineTo(p.x, p.y)
    octx.stroke()
  }

  function onPointerUp() {
    const stroke = drawingRef.current
    drawingRef.current = null
    if (stroke && stroke.points.length > 0) strokesRef.current.push(stroke)
  }

  function redrawOverlay() {
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const octx = overlay.getContext("2d")!
    const dpr = dprRef.current
    octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    octx.clearRect(0, 0, overlay.width, overlay.height)
    for (const s of strokesRef.current) {
      octx.strokeStyle = s.color
      octx.lineWidth = STROKE_WIDTH
      octx.lineCap = "round"
      octx.lineJoin = "round"
      octx.beginPath()
      s.points.forEach((p, i) => (i === 0 ? octx.moveTo(p.x, p.y) : octx.lineTo(p.x, p.y)))
      octx.stroke()
    }
  }

  function undo() { strokesRef.current.pop(); redrawOverlay() }
  function clearStrokes() { strokesRef.current = []; redrawOverlay() }

  async function save() {
    if (!hasImage || busy) return
    setBusy(true)
    setError("")
    try {
      const base = baseCanvasRef.current!
      const overlay = overlayCanvasRef.current!
      const out = document.createElement("canvas")
      out.width = base.width
      out.height = base.height
      const ctx = out.getContext("2d")!
      ctx.drawImage(base, 0, 0)
      ctx.drawImage(overlay, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", JPEG_QUALITY))
      if (!blob) { setError("Görsel oluşturulamadı"); setBusy(false); return }
      const file = new File([blob], `hasar-${Date.now()}.jpg`, { type: "image/jpeg" })
      const fd = new FormData()
      fd.set("intakeFormId", intakeFormId)
      fd.set("type", "damage_detail")
      fd.set("phase", phase)
      fd.set("label", label)
      if (note.trim()) fd.set("note", note.trim())
      fd.set("file", file)
      const res = await fetch("/api/intakes/photos", { method: "POST", body: fd })
      const data = (await res.json()) as { success?: boolean; id?: string; error?: string }
      if (!data?.success || !data.id) { setError(data?.error || "Yüklenemedi"); setBusy(false); return }
      const photo = { id: data.id, fileUrl: null }
      setUploaded((u) => [...u, photo])
      onUploaded?.(photo)
      strokesRef.current = []
      setNote("")
      setHasImage(false)
      setBusy(false)
    } catch {
      setError("Bir hata oluştu")
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      {!hasImage ? (
        <Button type="button" variant="outline" className="w-full h-12" onClick={() => fileInputRef.current?.click()}>
          <Camera className="size-4 mr-2" /> Foto çek / seç
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Renk ${c}`}
                onClick={() => setColor(c)}
                className={`size-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-border"}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="ml-auto flex gap-1">
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Geri al" onClick={undo}><Undo2 className="size-4" /></Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Temizle" onClick={clearStrokes}><Trash2 className="size-4" /></Button>
            </div>
          </div>

          <div className="relative w-full overflow-auto rounded-lg border border-border bg-muted/30">
            <div className="relative inline-block">
              <canvas ref={baseCanvasRef} className="block max-w-full touch-none" />
              <canvas
                ref={overlayCanvasRef}
                className="absolute left-0 top-0 max-w-full touch-none"
                style={{ touchAction: "none" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
          </div>

          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hasar notu (opsiyonel)…" />

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { strokesRef.current = []; setNote(""); setHasImage(false) }} disabled={busy}>Vazgeç</Button>
            <Button type="button" onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Kaydet"}</Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {uploaded.length > 0 && (
        <p className="text-xs text-muted-foreground">{uploaded.length} hasar fotoğrafı eklendi.</p>
      )}
    </div>
  )
}
