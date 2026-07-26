"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Camera, Undo2, Trash2, Pencil, ArrowUpRight, Square, Circle } from "lucide-react"
import { fitDimensions } from "@/lib/image/fit-dimensions"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85
const STROKE_WIDTH = 4
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#111827", "#ffffff"]

type Tool = "pen" | "arrow" | "rect" | "ellipse"
const TOOLS: { id: Tool; label: string; icon: typeof Pencil }[] = [
  { id: "pen", label: "Serbest çizim", icon: Pencil },
  { id: "arrow", label: "Ok", icon: ArrowUpRight },
  { id: "rect", label: "Dikdörtgen", icon: Square },
  { id: "ellipse", label: "Daire", icon: Circle },
]

type Point = { x: number; y: number }
type PenShape = { tool: "pen"; color: string; points: Point[] }
type BoxShape = { tool: "arrow" | "rect" | "ellipse"; color: string; start: Point; end: Point }
type Shape = PenShape | BoxShape
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const shapesRef = useRef<Shape[]>([])
  const drawingRef = useRef<Shape | null>(null)
  const dprRef = useRef(1)
  const logicalRef = useRef({ w: 0, h: 0 }) // çizim koordinat uzayı (CSS px)

  const [hasImage, setHasImage] = useState(false)
  const [displayTick, setDisplayTick] = useState(0) // yeni görsel → yeniden ölçekle
  const [tool, setTool] = useState<Tool>("pen")
  const [color, setColor] = useState(COLORS[0])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [uploaded, setUploaded] = useState<{ id: string; previewUrl: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const objectUrlsRef = useRef<string[]>([]) // unmount'ta serbest bırakılacak blob URL'leri

  useEffect(() => () => { objectUrlsRef.current.forEach(URL.revokeObjectURL) }, [])

  // Canvas'ı "contain" mantığıyla hem kapsayıcı genişliğine hem de bir azami
  // yüksekliğe sığdır (dikey ruhsat fotoğrafı ekranı domine etmesin). Buffer ve
  // çizim koordinatları mantıksal ölçekte kalır; sadece CSS boyutu değişir.
  function applyDisplaySize() {
    const { w, h } = logicalRef.current
    if (!w || !h) return
    const avail = scrollRef.current?.clientWidth || w
    const maxH = Math.max(240, Math.round(window.innerHeight * 0.7))
    const scale = Math.min(avail / w, maxH / h, 1)
    const dw = Math.round(w * scale)
    const dh = Math.round(h * scale)
    for (const c of [baseCanvasRef.current, overlayCanvasRef.current]) {
      if (!c) continue
      c.style.width = `${dw}px`
      c.style.height = `${dh}px`
    }
  }

  useLayoutEffect(() => {
    applyDisplaySize()
  }, [displayTick, hasImage])

  useEffect(() => {
    const onResize = () => applyDisplaySize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

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
      logicalRef.current = { w, h }
      const bctx = base.getContext("2d")!
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bctx.clearRect(0, 0, w, h)
      bctx.drawImage(img, 0, 0, w, h)
      const octx = overlay.getContext("2d")!
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
      octx.clearRect(0, 0, w, h)
      shapesRef.current = []
      setHasImage(true)
      setDisplayTick((t) => t + 1)
    } catch {
      setError("Görsel yüklenemedi")
    }
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    // Canvas "contain" ile küçültülür; render (rect) boyutunu mantıksal çizim
    // boyutuna ölçekle, yoksa çizgiler kayar.
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const logicalW = logicalRef.current.w || rect.width
    const logicalH = logicalRef.current.h || rect.height
    const sx = rect.width ? logicalW / rect.width : 1
    const sy = rect.height ? logicalH / rect.height : 1
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasImage) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointFromEvent(e)
    drawingRef.current =
      tool === "pen"
        ? { tool: "pen", color, points: [p] }
        : { tool, color, start: p, end: p }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const shape = drawingRef.current
    if (!shape) return
    const p = pointFromEvent(e)
    if (shape.tool === "pen") shape.points.push(p)
    else shape.end = p
    // Şekiller sürüklenirken boyut değiştiği için tüm overlay yeniden çizilir
    // (canlı önizleme). Kalem için de yeterince akıcı bu boyutlarda.
    renderOverlay()
  }

  function onPointerUp() {
    const shape = drawingRef.current
    drawingRef.current = null
    if (!shape) return
    const meaningful =
      shape.tool === "pen"
        ? shape.points.length > 0
        : Math.abs(shape.end.x - shape.start.x) > 2 || Math.abs(shape.end.y - shape.start.y) > 2
    if (meaningful) shapesRef.current.push(shape)
    renderOverlay() // yalnızca kısa dokunuşta oluşan önizlemeyi temizler
  }

  function applyStrokeStyle(ctx: CanvasRenderingContext2D, color: string) {
    ctx.strokeStyle = color
    ctx.lineWidth = STROKE_WIDTH
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }

  function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
    applyStrokeStyle(ctx, s.color)
    if (s.tool === "pen") {
      ctx.beginPath()
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
      return
    }
    const x = Math.min(s.start.x, s.end.x)
    const y = Math.min(s.start.y, s.end.y)
    const w = Math.abs(s.end.x - s.start.x)
    const h = Math.abs(s.end.y - s.start.y)
    if (s.tool === "rect") {
      ctx.strokeRect(x, y, w, h)
    } else if (s.tool === "ellipse") {
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      drawArrow(ctx, s.start, s.end)
    }
  }

  function drawArrow(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
    const head = Math.max(12, STROKE_WIDTH * 3)
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  }

  function renderOverlay() {
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const octx = overlay.getContext("2d")!
    const dpr = dprRef.current
    octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    octx.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr) // transform aktif → mantıksal koordinatlarda temizle
    for (const s of shapesRef.current) drawShape(octx, s)
    if (drawingRef.current) drawShape(octx, drawingRef.current)
  }

  function undo() { shapesRef.current.pop(); renderOverlay() }
  function clearStrokes() { shapesRef.current = []; renderOverlay() }

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
      const id = data.id
      // Yüklenen kareyi anında önizlemek için yerel blob URL'i sakla (sunucu
      // fileUrl döndürmüyor + kabul akışında token yok). unmount'ta serbest bırakılır.
      const previewUrl = URL.createObjectURL(blob)
      objectUrlsRef.current.push(previewUrl)
      setUploaded((u) => [...u, { id, previewUrl }])
      onUploaded?.({ id, fileUrl: null })
      shapesRef.current = []
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

      {!hasImage && (
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => fileInputRef.current?.click()}>
          <Camera className="size-4 mr-2" /> Foto çek / seç
        </Button>
      )}

      {/* Canvas'lar HER ZAMAN mount'lu kalır — onFileChange foto yüklenmeden ref'lere
          eriştiği için koşullu render'da ref'ler null oluyordu ("Görsel yüklenemedi").
          Foto gelene kadar paneli `hidden` ile gizliyoruz. */}
      <div className={hasImage ? "space-y-2" : "hidden"}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {TOOLS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-label={t.label}
                  aria-pressed={tool === t.id}
                  title={t.label}
                  onClick={() => setTool(t.id)}
                  className={`grid size-8 place-items-center rounded-md border ${tool === t.id ? "border-foreground bg-foreground/5 text-foreground" : "border-border text-muted-foreground"}`}
                >
                  <Icon className="size-4" />
                </button>
              )
            })}
          </div>
          <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
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

        <div ref={scrollRef} className="relative flex w-full justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
          <div className="relative inline-block">
            <canvas ref={baseCanvasRef} className="block touch-none" />
            <canvas
              ref={overlayCanvasRef}
              className="absolute left-0 top-0 touch-none"
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
          <Button type="button" variant="ghost" onClick={() => { shapesRef.current = []; setNote(""); setHasImage(false) }} disabled={busy}>Vazgeç</Button>
          <Button type="button" onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Kaydet"}</Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {uploaded.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Eklenen hasar fotoğrafları ({uploaded.length})
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {uploaded.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={`Hasar ${i + 1} — büyüt`}
                className="group relative aspect-square touch-manipulation overflow-hidden rounded-lg border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt={`Hasar ${i + 1}`}
                  className="size-full object-cover transition-transform group-active:scale-95"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <PhotoLightbox
        photos={uploaded.map((p, i): LightboxPhoto => ({ id: p.id, label: `Hasar ${i + 1}`, fileUrl: p.previewUrl }))}
        index={lightboxIndex ?? 0}
        onIndexChange={(n) => setLightboxIndex(n)}
        open={lightboxIndex !== null}
        onOpenChange={(o) => { if (!o) setLightboxIndex(null) }}
      />
    </div>
  )
}
