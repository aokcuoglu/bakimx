# Faz C — Foto Çek + İşaretle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intake wizard'ının "Fotoğraf" adımını ve detay sayfasının "Hasar" sekmesini, cihaz kamerasıyla foto çekip resim üstüne serbest kalemle hasar işaretleyen (flatten edilmiş JPEG olarak yüklenen) tek bir `PhotoAnnotate` bileşeniyle çalıştırmak; eski SVG hasar haritasını UI'dan kaldırmak.

**Architecture:** Plain HTML5 Canvas (base + overlay katman) ile mobil-öncelikli çizim; yakalanan görsel `fitDimensions` ile downscale edilir, çizim flatten edilip mevcut `POST /api/intakes/photos` (`addPhotoAction`) üzerinden `type=damage_detail`, `phase=intake` olarak yüklenir. Yeni model/alan yok; `DamageMark` tablosu dormant kalır.

**Tech Stack:** Next.js (App Router, client component), TypeScript strict, plain Canvas 2D + Pointer Events, mevcut storage/`VehiclePhoto` altyapısı, `bun test`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-25-faz-c-foto-cek-isaretle-design.md` (D1–D6 bağlayıcı).
- **Sıfır Prisma migrasyonu.** Yeni model/alan yok; yalnız mevcut `VehiclePhoto` (`type=damage_detail`, `phase=intake`, opsiyonel `note`).
- **Flatten (D1):** çizgiler foto'ya gömülür; ayrı orijinal/vektör yok.
- **Çekim (D2):** `<input type="file" accept="image/*" capture="environment">` + galeri.
- **Araç (D4):** plain Canvas; serbest kalem + renk (varsayılan kırmızı) + Geri Al + Temizle. Ağır çizim kütüphanesi EKLENMEZ.
- **DamageMark (D3):** SVG harita UI'dan kalkar; `DamageMark` tablosu + `addDamageMarkAction`/`removeDamageMarkAction` + `/api/intakes/damage` DURUR (silinmez).
- TypeScript strict; `any` yok (tipli `.json()` cast'i kabul). Türkçe UI. `bun install/add/update` ÇALIŞTIRMA; `package.json`/lockfile/`.env*`/`patches/` dosyalarına dokunma.
- Downscale: uzun kenar **1600px**, JPEG kalite **0.85**, çizgi kalınlığı **4px**.

---

### Task 1: `fitDimensions` saf yardımcı (TDD)

**Files:**
- Create: `src/lib/image/fit-dimensions.ts`
- Test: `src/lib/image/fit-dimensions.test.ts`

**Interfaces:**
- Produces: `fitDimensions(w: number, h: number, maxEdge: number): { w: number; h: number }` — oranı koruyarak uzun kenarı `maxEdge`'e indirir; zaten küçükse BÜYÜTMEZ; geçersiz (≤0) girdide `{w:0,h:0}`. Sonuçlar `Math.round`'lu.

- [ ] **Step 1: Failing test yaz**

`src/lib/image/fit-dimensions.test.ts`:

```ts
import { test, expect } from "bun:test"
import { fitDimensions } from "./fit-dimensions"

test("landscape büyük görsel uzun kenardan küçültülür", () => {
  expect(fitDimensions(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 })
})

test("portrait büyük görsel uzun kenardan küçültülür", () => {
  expect(fitDimensions(3000, 4000, 1600)).toEqual({ w: 1200, h: 1600 })
})

test("zaten küçük görsel büyütülmez", () => {
  expect(fitDimensions(800, 600, 1600)).toEqual({ w: 800, h: 600 })
})

test("tam sınırdaki görsel değişmez", () => {
  expect(fitDimensions(1600, 900, 1600)).toEqual({ w: 1600, h: 900 })
})

test("geçersiz boyut güvenli sıfır döner", () => {
  expect(fitDimensions(0, 100, 1600)).toEqual({ w: 0, h: 0 })
})
```

- [ ] **Step 2: Testi çalıştır, FAIL gör**

Run: `bun test src/lib/image/fit-dimensions.test.ts`
Expected: FAIL (modül/fonksiyon yok — "Cannot find module './fit-dimensions'").

- [ ] **Step 3: Minimal implementasyon**

`src/lib/image/fit-dimensions.ts`:

```ts
/** Oranı koruyarak uzun kenarı maxEdge'e indirir; zaten küçükse büyütmez. */
export function fitDimensions(w: number, h: number, maxEdge: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 }
  const longest = Math.max(w, h)
  if (longest <= maxEdge) return { w: Math.round(w), h: Math.round(h) }
  const scale = maxEdge / longest
  return { w: Math.round(w * scale), h: Math.round(h * scale) }
}
```

- [ ] **Step 4: Testi çalıştır, PASS gör**

Run: `bun test src/lib/image/fit-dimensions.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/image/fit-dimensions.ts src/lib/image/fit-dimensions.test.ts
git commit -m "feat: add fitDimensions image downscale helper (Faz C)"
```

---

### Task 2: `PhotoAnnotate` bileşeni

**Files:**
- Create: `src/components/app/photo-annotate.tsx`

**Interfaces:**
- Consumes: `fitDimensions` (Task 1); `POST /api/intakes/photos` (FormData: `intakeFormId`, `type`, `phase`, `label`, opsiyonel `note`, `file` → `{success,id}`).
- Produces: `PhotoAnnotate({ intakeFormId: string; label?: string; phase?: string; onUploaded?: (photo: { id: string; fileUrl: string | null }) => void })` — wizard ve detay sayfasının tükettiği bileşen.

- [ ] **Step 1: Bileşeni oluştur (tam içerik)**

`src/components/app/photo-annotate.tsx`:

```tsx
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
```

- [ ] **Step 2: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0; lint yeni hata yok (mevcut ~9 uyarı kalabilir); build exit 0. `size="icon-sm"` Button varyantı `src/components/ui/button.tsx`'te tanımlı (kullanılabilir).

- [ ] **Step 3: Commit**

```bash
git add src/components/app/photo-annotate.tsx
git commit -m "feat: add PhotoAnnotate (camera capture + on-image pen annotation) (Faz C)"
```

> **Manuel/görsel QA (ertelendi → `:3000`):** foto seç → kalemle çiz → renk değiştir → geri al → temizle → kaydet → "1 hasar fotoğrafı eklendi" → ikinci foto. Mobilde dokunmatik çizim akıcı; downscale ile büyük foto sorunsuz.

---

### Task 3: Wizard "Fotoğraf" adımına entegrasyon

**Files:**
- Modify: `src/components/app/intake-wizard.tsx` (yalnız `step === 4` bloğu + import)

**Interfaces:**
- Consumes: `PhotoAnnotate` (Task 2). `intakeId` zaten state'te (Kabul adımında set ediliyor).

- [ ] **Step 1: Import ekle**

`src/components/app/intake-wizard.tsx` import bloğuna ekle (CustomerVehiclePicker import'unun yanına):

```tsx
import { PhotoAnnotate } from "./photo-annotate"
```

- [ ] **Step 2: Fotoğraf adımının içeriğini değiştir**

`{step === 4 && (...)}` bloğunda, `<Alert ...>...</Alert>` (Fotoğraf Kontrolü bilgi kartı) yerine `PhotoAnnotate` koy; "Geri" ve "İş Emrine Git" butonları AYNEN kalsın. Yeni blok:

```tsx
        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Fotoğraf & Hasar İşaretleme</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {intakeId && <PhotoAnnotate intakeFormId={intakeId} />}
              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(3)} size="lg" className="h-12">
                  Geri
                </Button>
                <Button nativeButton={false} size="lg" className="h-12 gap-2" render={<Link href={`/intakes/${intakeId}`} />}>
                  İş Emrine Git
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
```

- [ ] **Step 3: Atıl import temizliği**

Fotoğraf adımındaki eski `<Alert>` kaldırıldığı için artık kullanılmayan import'ları sil. `Camera` STEPS dizisinde (Fotoğraf ikonu) hâlâ kullanılıyor → KALSIN. `Alert`/`AlertTitle`/`AlertDescription`: `source === "registration"` uyarısı `Alert`+`AlertDescription` kullanıyor → onlar kalır; yalnız hiçbir yerde kullanılmayan kalırsa (örn. `AlertTitle`) lint uyarır → kaldır. Adım sonunda lint'i çalıştırıp kullanılmayanları temizle.

- [ ] **Step 4: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0; lint yeni hata yok (kullanılmayan import kalmadığını doğrula); build exit 0 (`/intakes/new` derlenir).

- [ ] **Step 5: Commit**

```bash
git add src/components/app/intake-wizard.tsx
git commit -m "feat: wire PhotoAnnotate into intake wizard photo step (Faz C)"
```

---

### Task 4: Detay "Hasar" sekmesine entegrasyon + atıl SVG-harita kodu temizliği

**Files:**
- Modify: `src/components/app/intake-detail.tsx`

**Interfaces:**
- Consumes: `PhotoAnnotate` (Task 2). Mevcut `intake.photos` (her foto `{ id, type, fileUrl, ... }`), `PhotoGalleryCard` (mevcut), `handleRemovePhoto`/`handleReplacePhoto` (mevcut).

- [ ] **Step 1: Import ekle, `VehicleDamageMap` import'unu kaldır**

- Ekle: `import { PhotoAnnotate } from "./photo-annotate"`
- Kaldır: `import { VehicleDamageMap } from "@/components/damage/vehicle-damage-map"` (satır ~42).

- [ ] **Step 2: "damage" TabsContent içeriğini değiştir**

`<TabsContent value="damage">` içindeki **tüm** mevcut içeriği (`<VehicleDamageMap .../>` + hasar ekleme `<Dialog>`'u) şununla değiştir:

```tsx
      <TabsContent value="damage">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Hasar Fotoğrafı Ekle</CardTitle></CardHeader>
            <CardContent>
              <PhotoAnnotate intakeFormId={intake.id} onUploaded={() => router.refresh()} />
            </CardContent>
          </Card>

          {intake.photos.filter((p) => p.type === "damage_detail").length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Hasar Fotoğrafları ({intake.photos.filter((p) => p.type === "damage_detail").length})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {intake.photos.filter((p) => p.type === "damage_detail").map((photo) => (
                    <PhotoGalleryCard
                      key={photo.id}
                      photo={photo}
                      onRemove={handleRemovePhoto}
                      onReplace={handleReplacePhoto}
                      isUploading={uploadingPhotoId === photo.id}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
```

- [ ] **Step 3: Atıl SVG-harita state + handler'larını kaldır**

Aşağıdakiler artık kullanılmıyor (yalnız kaldırılan harita/dialog'da kullanılıyordu) → sil:
- State: `showDamageModal`, `selectedZone`, `damageType`, `severity`, `damageNote` (satır ~96-100).
- Fonksiyonlar: `handleAddDamageMark` (~152-180), `handleRemoveDamageMark` (~182-187).
- Kullanılmayan kalan import'lar (lint ile doğrula; örn. `VEHICLE_ZONES`, `DAMAGE_TYPES`, `DAMAGE_SEVERITY`, `ToggleGroup`/`ToggleGroupItem`, ve yalnız hasar-dialog'unda kullanılan `Select*` parçaları başka yerde kullanılmıyorsa) → kaldır.
- `addDamageMarkAction`/`removeDamageMarkAction`/`/api/intakes/damage` BACKEND'ine DOKUNMA (dormant kalır). `DamageMark` modeli DURUR.

- [ ] **Step 4: "Hasar" sekmesi sayacını hasar-fotoğrafına çevir**

Sekme tanımındaki `count: intake.damageMarks.length` ve varsa `damageCount={intake.damageMarks.length}` → `intake.photos.filter((p) => p.type === "damage_detail").length` olarak güncelle (sekme rozeti artık hasar fotoğraflarını sayar). `intake.damageMarks` prop'u başka yerde kullanılmıyorsa bırakılabilir (legacy veri; kaldırmak migrasyon/şema dokunuşu gerektirmez ama gerekli değil).

- [ ] **Step 5: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0; lint yeni hata yok (tüm atıl state/handler/import temizlenmiş); build exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/intake-detail.tsx
git commit -m "feat: replace SVG damage map with PhotoAnnotate in intake detail (Faz C)"
```

> **Manuel/görsel QA (ertelendi → `:3000`):** detay "Hasar" sekmesinde foto çek+işaretle+kaydet → galeride görünür; SVG haritanın kalktığını doğrula; sekme rozeti hasar foto sayısını gösterir.

---

## Sonraki / kapsam dışı
- Eski `DamageMark` kayıtları için salt-okunur legacy görünüm (gerekirse).
- Teslimat fotoları/OTP (Faz D — teslimat akışı).
- Faz C tamamlanınca: authoritative gate + final whole-branch review (opus) → Faz A+B+C birlikte PR #5'e push.
