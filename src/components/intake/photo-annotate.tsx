"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { Camera, Images } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { fitDimensions } from "@/lib/image/fit-dimensions"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { photoAnnotationDocumentSchema, type PhotoAnnotationDocument } from "@/lib/image/photo-annotation"
import type { PhotoEditorProps } from "./photo-editor"

/** Konva is fetched only when a source is selected or a saved editor is opened. */
export const PhotoEditor = dynamic<PhotoEditorProps>(() => import("./photo-editor"), { ssr: false, loading: () => <p>Fotoğraf editörü yükleniyor…</p> })

async function orientSource(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  try {
    const { w, h } = fitDimensions(bitmap.width, bitmap.height, 1600)
    const canvas = document.createElement("canvas")
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Fotoğraf hazırlanamadı")
    ctx.drawImage(bitmap, 0, 0, w, h)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Fotoğraf hazırlanamadı")), "image/jpeg", 0.85))
  } finally { bitmap.close() }
}

export function PhotoAnnotate({ intakeFormId, label = "Hasar", phase = "intake", damageMarkId, onUploaded, onDirtyChange }: {
  intakeFormId: string; label?: string; phase?: string; damageMarkId?: string
  onDirtyChange?: (dirty: boolean) => void
  onUploaded?: (photo: { id: string; fileUrl: string | null }) => void
}) {
  const camera = useRef<HTMLInputElement>(null), gallery = useRef<HTMLInputElement>(null)
  const [queue, setQueue] = useState<File[]>([])
  const [source, setSource] = useState<{ blob: Blob; url: string; requestId: string } | null>(null)
  const [error, setError] = useState("")
  const [preparing, setPreparing] = useState(false)
  const [count, setCount] = useState(0)
  const uploadedId = useRef<string | null>(null)
  const annotationRequest = useRef<string | null>(null)
  const lastDocument = useRef("")
  useEffect(() => { onDirtyChange?.(Boolean(source || queue.length || preparing)) }, [source, queue.length, preparing, onDirtyChange])
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url) }, [source])
  useEffect(() => {
    if (!source && !queue.length) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [source, queue.length])
  async function prepare(file: File) {
    setPreparing(true); setError("")
    try {
      const blob = await orientSource(file)
      uploadedId.current = null; annotationRequest.current = crypto.randomUUID()
      setSource({ blob, url: URL.createObjectURL(blob), requestId: crypto.randomUUID() })
    } catch { setError("Fotoğraf okunamadı. Başka bir görsel seçebilirsiniz.") }
    finally { setPreparing(false) }
  }
  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 20)
    event.target.value = ""
    if (!files.length) return
    setQueue(files.slice(1)); await prepare(files[0])
  }
  async function advance() {
    setSource(null)
    const [next, ...rest] = queue
    setQueue(rest)
    if (next) await prepare(next)
  }
  const save: PhotoEditorProps["onSave"] = async ({ annotation, derivative }) => {
    if (!source) return
    if (!uploadedId.current) {
      const form = new FormData()
      form.set("intakeFormId", intakeFormId); form.set("type", "damage_detail"); form.set("phase", phase); form.set("label", label)
      form.set("requestId", source.requestId); form.set("file", source.blob, "hasar-kaynak.jpg")
      if (damageMarkId) form.set("damageMarkId", damageMarkId)
      const response = await fetch("/api/intakes/photos", { method: "POST", body: form })
      const data = await response.json()
      if (!response.ok || !data.id) throw new Error(data.error ?? "Fotoğraf yüklenemedi; tekrar deneyin.")
      uploadedId.current = data.id
    }
    const serialized = JSON.stringify(annotation)
    if (lastDocument.current !== serialized) { annotationRequest.current = crypto.randomUUID(); lastDocument.current = serialized }
    const form = new FormData()
    form.set("photoId", uploadedId.current!); form.set("requestId", annotationRequest.current!)
    form.set("expectedVersion", "0"); form.set("document", JSON.stringify(annotation)); form.set("file", derivative, "hasar-isaretli.jpg")
    const response = await fetch("/api/intakes/photos/annotations", { method: "POST", body: form })
    const data = await response.json()
    if (!response.ok || !data.success) throw new Error(data.error ?? "Çizimler yüklenemedi; taslak korundu. Tekrar deneyin.")
    onUploaded?.({ id: uploadedId.current!, fileUrl: `/api/photos?id=${uploadedId.current}&variant=annotated&v=${data.version}` })
    setCount(c => c + 1)
    await advance()
  }
  return <div className="space-y-3">
    <Input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={choose} />
    <Input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={choose} />
    {!source && <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="outline" disabled={preparing} onClick={() => camera.current?.click()}><Camera className="size-4" />Foto çek</Button>
      <Button type="button" variant="outline" disabled={preparing} onClick={() => gallery.current?.click()}><Images className="size-4" />Galeriden seç</Button>
    </div>}
    {preparing && <p className="text-sm text-muted-foreground">Fotoğraf hazırlanıyor…</p>}
    {source && <PhotoEditor key={source.requestId} sourceUrl={source.url} onSave={save} onCancel={() => { setSource(null); setQueue([]) }} />}
    {!source && !preparing && queue.length > 0 && <Button type="button" variant="outline" onClick={advance}>Sıradaki fotoğrafla devam et</Button>}
    {queue.length > 0 && <p className="text-sm text-muted-foreground">Sırada {queue.length} fotoğraf var.</p>}
    {count > 0 && <p className="text-sm text-muted-foreground">{count} fotoğraf kaydedildi.</p>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
  </div>
}


/** Existing JPEGs open as their own source; no attempt is made to undo baked-in legacy ink. */
export function PersistedPhotoEditor({ photoId, onSaved, onDirtyChange, disabled = false }: { photoId: string; onSaved?: () => void; onDirtyChange?: (dirty: boolean) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<{ document: PhotoAnnotationDocument; version: number } | null>(null)
  const [error, setError] = useState("")
  const requestId = useRef("")
  const lastDocument = useRef("")
  async function launch() {
    setLoading(true); setError("")
    try {
      const response = await fetch(`/api/intakes/photos/annotations?photoId=${encodeURIComponent(photoId)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Çizimler yüklenemedi")
      const document = photoAnnotationDocumentSchema.parse(data.document ?? { version: 1, shapes: [] })
      requestId.current = crypto.randomUUID()
      setSaved({ document, version: data.version }); setOpen(true)
    } catch (e) { setError(e instanceof Error ? e.message : "Çizimler yüklenemedi") }
    finally { setLoading(false) }
  }
  const save: PhotoEditorProps["onSave"] = async ({ annotation, derivative }) => {
    const serialized = JSON.stringify(annotation)
    if (lastDocument.current !== serialized) { requestId.current = crypto.randomUUID(); lastDocument.current = serialized }
    const form = new FormData()
    form.set("photoId", photoId); form.set("requestId", requestId.current)
    form.set("expectedVersion", String(saved?.version ?? 0)); form.set("document", JSON.stringify(annotation)); form.set("file", derivative, "hasar-isaretli.jpg")
    const response = await fetch("/api/intakes/photos/annotations", { method: "POST", body: form })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "Kaydedilemedi. Taslak korundu; tekrar deneyin.")
    setOpen(false); onSaved?.()
  }
  return <>
    <Button type="button" variant="outline" size="sm" disabled={disabled || loading} onClick={launch}>{loading ? "Yükleniyor…" : "Çizimleri düzenle"}</Button>
    {error && <p role="alert" className="text-sm text-destructive-strong">{error}</p>}
    <Dialog open={open} onOpenChange={next => { if (!next && window.confirm("Editörü kaydetmeden kapatmak istiyor musunuz?")) setOpen(false) }}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-4xl" onInteractOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>Fotoğraf çizimleri</DialogTitle><DialogDescription>İşaretsiz kaynak korunur; her kayıt yeni bir çizim sürümü oluşturur.</DialogDescription></DialogHeader>
        {open && saved && <PhotoEditor sourceUrl={`/api/photos?id=${encodeURIComponent(photoId)}&variant=original`} initialAnnotation={saved.document} onDirtyChange={onDirtyChange} onSave={save} onCancel={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  </>
}
