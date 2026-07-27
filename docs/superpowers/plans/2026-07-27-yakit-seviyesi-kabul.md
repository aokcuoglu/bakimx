# Araç Kabulünde Yakıt Seviyesi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Araç kabulünde yakıt seviyesi (E · 1/4 · 1/2 · 3/4 · Full) seçilebilsin, gösterge fotoğrafı zorunlu olsun, seviye personel ve müşteri yüzeylerinde araç ibresine benzeyen bir kadranla gösterilsin.

**Architecture:** Seviye `VehicleIntakeForm.fuelLevelAtIntake` kolonunda yüzde olarak (0/25/50/75/100) saklanır. Tüm domain mantığı (izin verilen değerler, Türkçe kesir etiketi, ibre geometrisi, PDF için SVG string) tek bir `src/lib/fuel-level.ts` modülünde toplanır; React kadranı (`fuel-gauge.tsx`) ve PDF route'ları aynı geometriyi bu modülden alır. Fotoğraf tarafı mevcut `PHOTO_TYPES` sabitine yeni bir zorunlu tip eklemekten ibarettir — kontrol listesi ve tamamlanma hesabı bu sabitten türediği için ek kod gerekmez.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Prisma + PostgreSQL, Tailwind v4, Base UI tabanlı shadcn bileşenleri (`src/components/ui/*`), zod v4, bun.

**Spec:** `docs/superpowers/specs/2026-07-27-yakit-seviyesi-kabul-design.md`
**Worktree:** `/Users/void/www/bakimx-yakit` · **Branch:** `feat/fuel-level-at-intake` (base: `dev`)

## Global Constraints

- Tüm kullanıcıya görünen metinler Türkçe.
- Bu projede otomatik test altyapısı **yok** (vitest/jest/playwright kurulu değil). Her görevin doğrulaması: `bun run typecheck` + `bun run lint` + tarayıcıda elle kontrol. Test framework'ü **kurma** — kapsam dışı.
- Yeni UI yalnızca `src/components/ui/*` altındaki mevcut bileşenlerden kurulur (Base UI tabanlı shadcn). Yeni npm paketi ekleme.
- Form/kontrol yüksekliği web'de `h-9` (`size="lg"` toggle varyantı bunu verir). `h-10`/`h-11` override etme.
- Yeni `fixed`/`sticky` dip aksiyon barı ekleme — proje konvansiyonu bunları kaldırdı.
- `any` kullanma; TypeScript strict.
- Sunucu tarafında `workshopId` her zaman `requireAuth()`'tan türetilir, istemciden gelen değere asla güvenilmez.
- `src/lib/intake/data-safety.ts` ve `src/lib/passport/data-safety.ts` **açık izin listesi** ile çalışır: eklenmeyen alan müşteriye ulaşmaz. Yeni alan bilinçli olarak eklenir.
- Yeni timeline `eventType` ekleme (mevcut `intake_details_edited` yeniden kullanılır) — yeni event tipi müşteri PDF'ine sızma riski taşır.
- Mobil öncelikli: 360 px genişlikte 5 buton taşmadan sığmalı.
- Her görev sonunda commit; commit mesajları Türkçe, `feat:` / `fix:` / `refactor:` öneki ile.

---

### Task 1: Veri katmanı — kolon, enum, domain modülü

**Files:**
- Modify: `prisma/schema.prisma` (`VehicleIntakeForm` modeli ~satır 437-462, `VehiclePhotoType` enum ~satır 505-516)
- Create: `prisma/migrations/<timestamp>_add_fuel_level_at_intake/migration.sql` (Prisma üretir)
- Create: `src/lib/fuel-level.ts`
- Modify: `src/lib/constants.ts` (`PHOTO_TYPES`, ~satır 83-94)

**Interfaces:**
- Consumes: —
- Produces:
  - Prisma alanı `VehicleIntakeForm.fuelLevelAtIntake: number | null`
  - Prisma enum değeri `VehiclePhotoType.fuel_gauge`
  - `FUEL_LEVELS: readonly [0, 25, 50, 75, 100]`
  - `type FuelLevel = 0 | 25 | 50 | 75 | 100`
  - `isFuelLevel(value: unknown): value is FuelLevel`
  - `formatFuelLevel(value: number): string` → `"E" | "1/4" | "1/2" | "3/4" | "Full"`
  - `fuelNeedlePoint(value: number, radius?: number): { x: number; y: number }`
  - `isLowFuel(value: number): boolean`
  - `fuelGaugeSvgMarkup(value: number, width?: number): string`

- [ ] **Step 1: Şemaya kolonu ekle**

`prisma/schema.prisma` içinde `model VehicleIntakeForm` bloğunda `mileageAtIntake` satırının hemen altına:

```prisma
  mileageAtIntake     Int?
  /// Kabulde ölçülen yakıt seviyesi. Yüzde olarak saklanır ve yalnızca çeyrek
  /// kademelere izin verilir (0/25/50/75/100); sunum katmanı "1/4", "1/2" gibi
  /// kesirlere çevirir. null = ölçülmedi. Yüzde seçilmesinin sebebi ileride
  /// 1/8 kademeye geçilirse şema değişikliği gerekmemesi.
  fuelLevelAtIntake   Int?
```

- [ ] **Step 2: Foto tipi enum'una yeni değeri ekle**

Aynı dosyada `enum VehiclePhotoType` bloğunda `dashboard_mileage` satırının altına `fuel_gauge` ekle:

```prisma
enum VehiclePhotoType {
  front
  rear
  left_side
  right_side
  dashboard_mileage
  fuel_gauge
  registration_front
  registration_back
  vin_area
  damage_detail
  other
}
```

- [ ] **Step 3: Migration'ı yerel throwaway DB'de yaz**

Şu komutu çalıştır:

```bash
bun run db:migrate --name add_fuel_level_at_intake
```

Bu script yerel OrbStack Postgres'i ayağa kaldırıp `prisma migrate dev` çalıştırır (paylaşılan AWS dev DB'ye **asla** `migrate dev` çalıştırma).

Beklenen migration SQL'i (iki geri-uyumlu DDL):

```sql
-- AlterEnum
ALTER TYPE "VehiclePhotoType" ADD VALUE 'fuel_gauge';

-- AlterTable
ALTER TABLE "VehicleIntakeForm" ADD COLUMN "fuelLevelAtIntake" INTEGER;
```

Sorun giderme:
- `ECONNREFUSED localhost:5432` → OrbStack kapalı: `docker compose -f docker-compose.local.yml up -d db`.
- "drift detected / migration not found" → yerel DB'yi başka bir worktree kirletmiş demektir. Bu worktree'ye ayrı DB aç ve tek seferlik şöyle çalıştır:
  ```bash
  docker exec bakimx-db-1 psql -U bakimx -c 'CREATE DATABASE bakimx_yakit;'
  DATABASE_URL='postgresql://bakimx:bakimx@localhost:5432/bakimx_yakit' \
  DIRECT_URL='postgresql://bakimx:bakimx@localhost:5432/bakimx_yakit' \
  bunx prisma migrate dev --name add_fuel_level_at_intake
  ```
- `ALTER TYPE ... cannot run inside a transaction block` hatası görürsen: aynı migration içinde yeni enum değerini **kullanma** (bu planda kullanılmıyor); hata devam ederse enum ekleme ve kolon ekleme adımlarını iki ayrı migration'a böl.

- [ ] **Step 4: Prisma client'ın yeni alanı tanıdığını doğrula**

Run: `bunx prisma generate && bun run typecheck`
Expected: hata yok. (`prisma generate` postinstall'da da çalışır; şema değişince dev server'ı yeniden başlatmak gerekir.)

- [ ] **Step 5: Foto kontrol listesine yeni tipi ekle**

`src/lib/constants.ts` içindeki `PHOTO_TYPES` sabitinde `dashboard_mileage` satırının altına:

```ts
export const PHOTO_TYPES = {
  front: { label: "Ön", required: true },
  rear: { label: "Arka", required: true },
  left_side: { label: "Sol yan", required: true },
  right_side: { label: "Sağ yan", required: true },
  dashboard_mileage: { label: "Kilometre", required: true },
  fuel_gauge: { label: "Yakıt göstergesi", required: true },
  registration_front: { label: "Ruhsat ön", required: false },
  registration_back: { label: "Ruhsat arka", required: false },
  vin_area: { label: "VIN alanı", required: false },
  damage_detail: { label: "Hasar detayı", required: false },
  other: { label: "Diğer", required: false },
} as const
```

Not: `src/lib/intake/completeness.ts` zorunlu/eksik listesini bu sabitten türetiyor; ek kod gerekmez. Yan etki bilinçlidir: zorunlu foto 5 → 6, toplam 10 → 11 olur ve eski kabuller "Eksik: Yakıt göstergesi" gösterir.

- [ ] **Step 6: Domain modülünü oluştur**

Create `src/lib/fuel-level.ts`:

```ts
/**
 * Kabulde ölçülen yakıt seviyesi.
 *
 * DB'de yüzde olarak saklanır ama yalnızca çeyrek kademelere izin verilir —
 * böylece ileride 1/8 kademe istenirse şema değişmez, sadece bu liste büyür.
 * Kullanıcıya her zaman kesir olarak ("1/4", "1/2") gösterilir.
 */
export const FUEL_LEVELS = [0, 25, 50, 75, 100] as const

export type FuelLevel = (typeof FUEL_LEVELS)[number]

const FUEL_LEVEL_LABELS: Record<FuelLevel, string> = {
  0: "E",
  25: "1/4",
  50: "1/2",
  75: "3/4",
  100: "Full",
}

export function isFuelLevel(value: unknown): value is FuelLevel {
  return typeof value === "number" && (FUEL_LEVELS as readonly number[]).includes(value)
}

export function formatFuelLevel(value: number): string {
  return isFuelLevel(value) ? FUEL_LEVEL_LABELS[value] : `%${value}`
}

/** Düşük yakıt eşiği: ibre ve etiket uyarı tonuna geçer. */
export function isLowFuel(value: number): boolean {
  return value <= 25
}

/**
 * Kadran geometrisi: merkez (50,50), yay yarıçapı 40, E solda (180°) F sağda (0°).
 * viewBox "0 0 100 62" varsayılır — hem React bileşeni hem PDF çıktısı bunu kullanır.
 */
export function fuelNeedlePoint(value: number, radius = 30): { x: number; y: number } {
  const clamped = Math.min(100, Math.max(0, value))
  const rad = ((180 - (clamped / 100) * 180) * Math.PI) / 180
  return { x: 50 + radius * Math.cos(rad), y: 50 - radius * Math.sin(rad) }
}

/**
 * PDF çıktıları HTML string üretiyor (React değil), bu yüzden kadranın string
 * karşılığı burada duruyor. Sayısal değerler dışında dışarıdan içerik almaz —
 * enjeksiyon yüzeyi yoktur.
 */
export function fuelGaugeSvgMarkup(value: number, width = 64): string {
  const clamped = Math.min(100, Math.max(0, value))
  const color = isLowFuel(clamped) ? "#B91C1C" : "#0B1F3A"
  const needle = fuelNeedlePoint(clamped)
  const arcEnd = fuelNeedlePoint(clamped, 40)
  const height = Math.round(width * 0.62)
  const progress =
    clamped > 0
      ? `<path d="M 10 50 A 40 40 0 0 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`
      : ""
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 100 62">`,
    `<path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E2E8F0" stroke-width="8" stroke-linecap="round"/>`,
    progress,
    `<line x1="50" y1="50" x2="${needle.x.toFixed(2)}" y2="${needle.y.toFixed(2)}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`,
    `<circle cx="50" cy="50" r="4" fill="${color}"/>`,
    `<text x="4" y="61" font-size="11" fill="#64748B">E</text>`,
    `<text x="86" y="61" font-size="11" fill="#64748B">F</text>`,
    `</svg>`,
  ].join("")
}
```

- [ ] **Step 7: Doğrula**

Run: `bun run typecheck && bun run lint`
Expected: ikisi de hatasız.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/fuel-level.ts src/lib/constants.ts
git commit -m "feat(intake): yakıt seviyesi kolonu, foto tipi ve domain modülü"
```

---

### Task 2: Kadran bileşeni (görünüm + seçim)

**Files:**
- Create: `src/components/intake/fuel-gauge.tsx`

**Interfaces:**
- Consumes: `FUEL_LEVELS`, `formatFuelLevel`, `fuelNeedlePoint`, `isLowFuel` (Task 1)
- Produces:
  - `<FuelGauge value={number} size?: "sm" | "md" showLabel?: boolean className?: string />`
  - `<FuelLevelPicker value={number | null} onChange={(value: number | null) => void} disabled?: boolean />`

- [ ] **Step 1: Bileşeni yaz**

Create `src/components/intake/fuel-gauge.tsx`:

```tsx
"use client"

import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FUEL_LEVELS, formatFuelLevel, fuelNeedlePoint, isLowFuel } from "@/lib/fuel-level"

const GAUGE_WIDTHS = {
  sm: "w-14",
  md: "w-28",
} as const

/**
 * Araç göstergesine benzeyen yarım-ay yakıt kadranı (salt görünüm).
 * Geometri src/lib/fuel-level.ts ile ortak — PDF çıktısı da aynı kadranı üretir.
 */
export function FuelGauge({
  value,
  size = "md",
  showLabel = true,
  className,
}: {
  value: number
  size?: keyof typeof GAUGE_WIDTHS
  showLabel?: boolean
  className?: string
}) {
  const needle = fuelNeedlePoint(value)
  const arcEnd = fuelNeedlePoint(value, 40)
  const low = isLowFuel(value)

  return (
    <div className={cn("inline-flex flex-col items-center gap-0.5", className)}>
      <svg
        viewBox="0 0 100 62"
        className={cn(GAUGE_WIDTHS[size], low ? "text-destructive" : "text-primary")}
        role="img"
        aria-label={`Yakıt seviyesi: ${formatFuelLevel(value)}`}
      >
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" strokeWidth={8} strokeLinecap="round" className="stroke-muted" />
        {value > 0 && (
          <path
            d={`M 10 50 A 40 40 0 0 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={8}
            strokeLinecap="round"
          />
        )}
        <line
          x1="50"
          y1="50"
          x2={needle.x.toFixed(2)}
          y2={needle.y.toFixed(2)}
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="4" fill="currentColor" />
        <text x="4" y="61" fontSize="11" className="fill-muted-foreground">E</text>
        <text x="86" y="61" fontSize="11" className="fill-muted-foreground">F</text>
      </svg>
      {showLabel && (
        <span className={cn("text-xs font-medium", low ? "text-destructive" : "text-foreground")}>
          {formatFuelLevel(value)}
        </span>
      )}
    </div>
  )
}

/**
 * Kadran + 5 kademeli seçim. Seçili kademeye tekrar dokunmak seçimi kaldırır
 * (Base UI ToggleGroup davranışı) → değer null olur = "ölçülmedi".
 */
export function FuelLevelPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <FuelGauge value={value ?? 0} size="md" showLabel={false} className={value == null ? "opacity-40" : undefined} />
      </div>
      <ToggleGroup
        value={value != null ? [String(value)] : []}
        onValueChange={(v) => onChange(v.length ? Number(v[0]) : null)}
        variant="outline"
        size="lg"
        disabled={disabled}
        className="w-full"
      >
        {FUEL_LEVELS.map((level) => (
          <ToggleGroupItem key={level} value={String(level)} className="flex-1">
            {formatFuelLevel(level)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
```

- [ ] **Step 2: Doğrula**

Run: `bun run typecheck && bun run lint`
Expected: hatasız. `ToggleGroup` kullanımının repodaki mevcut örnekle (`src/components/parts/stock-movement-dialog.tsx:82`) aynı imzada olduğunu gözle doğrula: `value={[x]}` dizi, `onValueChange` dizi alır.

- [ ] **Step 3: Commit**

```bash
git add src/components/intake/fuel-gauge.tsx
git commit -m "feat(intake): yakıt kadranı ve seviye seçici bileşeni"
```

---

### Task 3: Kabul sihirbazında yakıt seçimi (yazma yolu)

**Files:**
- Modify: `src/lib/validations/intake.ts`
- Modify: `src/app/(app)/intakes/actions.ts:14-87` (`createIntakeAction`)
- Modify: `src/components/intake/intake-wizard.tsx:84-102` (defaultValues), `:197-202` (FormData), `:298-324` (Adım 3 alanları)

**Interfaces:**
- Consumes: `isFuelLevel` (Task 1), `<FuelLevelPicker>` (Task 2)
- Produces: `intakeCreateSchema.fuelLevelAtIntake?: FuelLevel`, `intakeSchema.fuelLevelAtIntake: string`

- [ ] **Step 1: Zod şemalarını güncelle**

`src/lib/validations/intake.ts` başına import ekle ve iki şemayı genişlet:

```ts
import { z } from "zod/v4"
import { isFuelLevel } from "@/lib/fuel-level"
```

`intakeSchema` içinde `mileageAtIntake` satırının altına (form değerleri string tutulur):

```ts
  mileageAtIntake: z.string().optional().default(""),
  fuelLevelAtIntake: z.string().optional().default(""),
```

`intakeCreateSchema` içinde `mileageAtIntake` satırının altına:

```ts
  // DİKKAT: 0 ("E") geçerli bir seviye — km'de kullanılan `|| null` kalıbı burada
  // kullanılamaz. Boş string coerce edilmeden önce undefined'a çevrilir, aksi
  // halde Number("") === 0 olur ve "boş" ile "E" birbirine karışır.
  fuelLevelAtIntake: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().refine(isFuelLevel, "Geçersiz yakıt seviyesi").optional(),
  ),
```

Aynı alanı `intakeUpdateSchema` içine de ekle, ama düzenlemede "temizleme" ayırt edilebilsin diye `null` kabul edecek şekilde:

```ts
  // null = kullanıcı seçimi kaldırdı; alan hiç gönderilmemişse (undefined)
  // mevcut değer korunur (bkz. updateIntakeDetailsAction).
  fuelLevelAtIntake: z
    .union([z.null(), z.coerce.number().refine(isFuelLevel, "Geçersiz yakıt seviyesi")])
    .optional(),
```

- [ ] **Step 2: Sunucu action'ında kaydet**

`src/app/(app)/intakes/actions.ts` içinde `createIntakeAction`:

`raw` nesnesine (satır 17-23) ekle:

```ts
    mileageAtIntake: formData.get("mileageAtIntake") as string,
    fuelLevelAtIntake: formData.get("fuelLevelAtIntake") as string,
```

`tx.vehicleIntakeForm.create` data bloğuna (satır 48-55) ekle:

```ts
        mileageAtIntake: parsed.data.mileageAtIntake || null,
        fuelLevelAtIntake: parsed.data.fuelLevelAtIntake ?? null,
```

`?? null` kullanıldığına dikkat: `0` geçerli bir seviyedir, `||` onu null'a çevirirdi.

- [ ] **Step 3: Sihirbaz formuna alanı bağla**

`src/components/intake/intake-wizard.tsx`:

1. Import ekle: `import { FuelLevelPicker } from "@/components/intake/fuel-gauge"`
2. `defaultValues` içine `mileageAtIntake: "",` satırının altına `fuelLevelAtIntake: "",` ekle.
3. `handleCreateIntake` içindeki FormData bloğuna (satır ~201) ekle:

```ts
      formData.set("mileageAtIntake", values.mileageAtIntake)
      formData.set("fuelLevelAtIntake", values.fuelLevelAtIntake)
```

4. Adım 3'te "Yeni Kilometre" `FormField`'ının hemen ardından (satır ~324, `customerComplaint` alanından önce):

```tsx
                <FormField
                  control={form.control}
                  name="fuelLevelAtIntake"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yakıt Seviyesi</FormLabel>
                      <FormControl>
                        <FuelLevelPicker
                          value={field.value === "" ? null : Number(field.value)}
                          onChange={(v) => field.onChange(v == null ? "" : String(v))}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Gösterge panelindeki ibreyi işaretleyin. Fotoğrafı bir sonraki adımda ekleyeceksiniz.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
```

- [ ] **Step 4: Uçtan uca elle doğrula**

Şema değiştiği için dev server'ı yeniden başlat (`bun run dev`; AWS dev DB'ye bağlanıyorsa ayrı terminalde `bun run db:tunnel` açık olmalı ve migration `bun run db:deploy` ile uygulanmış olmalı).

1. `/orders/new` → müşteri/araç seç → Adım 3'e geç.
2. Kadranın E'de soluk (opacity) durduğunu gör; "1/2"ye dokun → ibre yarıya dönmeli, kadran normal opaklığa geçmeli.
3. "1/4"e dokun → ibre ve etiket kırmızıya (destructive) dönmeli.
4. Şikayet gir, "Devam" ile kabul oluştur.
5. DB'den doğrula:
   ```bash
   docker exec bakimx-db-1 psql -U bakimx -d bakimx -c 'SELECT id, "mileageAtIntake", "fuelLevelAtIntake" FROM "VehicleIntakeForm" ORDER BY "createdAt" DESC LIMIT 1;'
   ```
   (AWS dev DB kullanıyorsan aynı sorguyu tünel üzerinden çalıştır.)
   Expected: yeni satırda `fuelLevelAtIntake = 25`.
6. Ayrı bir kabulde hiç seçim yapmadan ilerle → değer `NULL` olmalı (0 **değil**).
7. Adım 4'te fotoğraf listesinde "Yakıt göstergesi" satırının zorunlu olarak göründüğünü doğrula.

- [ ] **Step 5: Doğrula ve commit**

Run: `bun run typecheck && bun run lint`

```bash
git add src/lib/validations/intake.ts "src/app/(app)/intakes/actions.ts" src/components/intake/intake-wizard.tsx
git commit -m "feat(intake): kabul sihirbazında yakıt seviyesi seçimi"
```

---

### Task 4: İş emri detayında gösterim ve düzenleme

**Files:**
- Modify: `src/app/(app)/intakes/actions.ts:133-219` (`updateIntakeDetailsAction`)
- Modify: `src/app/api/intakes/[id]/route.ts:17-33` (PATCH gövdesi)
- Modify: `src/app/(app)/orders/[id]/page.tsx:180`, `:206` (veri geçişi)
- Modify: `src/components/orders/work-order-detail.tsx` (tip ~132, `startEditInfo` ~277-283, `handleSaveInfo` ~285-304, araç meta satırı ~626-630, düzenleme formu ~666-669)

**Interfaces:**
- Consumes: `intakeUpdateSchema.fuelLevelAtIntake` (Task 3), `<FuelGauge>` / `<FuelLevelPicker>` (Task 2), `formatFuelLevel` (Task 1)
- Produces: `order.intake.fuelLevelAtIntake: number | null` (istemci prop'u)

- [ ] **Step 1: Güncelleme action'ını genişlet**

`src/app/(app)/intakes/actions.ts` → `updateIntakeDetailsAction`:

1. İmzayı genişlet (satır 133-136):

```ts
export async function updateIntakeDetailsAction(
  intakeFormId: string,
  input: { customerComplaint: string; internalNote?: string; mileageAtIntake?: string; fuelLevelAtIntake?: number | null },
) {
```

2. `newMileage` tanımının altına ekle (satır ~155):

```ts
  // Alan hiç gönderilmediyse (undefined) mevcut değer korunur; açıkça null
  // gönderildiyse seçim kaldırılmış demektir. 0 ("E") geçerli değerdir.
  const newFuel =
    parsed.data.fuelLevelAtIntake === undefined ? intake.fuelLevelAtIntake : parsed.data.fuelLevelAtIntake
```

3. Değişiklik listesine ekle (satır ~166 civarı):

```ts
  if ((intake.fuelLevelAtIntake ?? null) !== newFuel) changes.push("yakıt seviyesi")
```

4. `tx.vehicleIntakeForm.updateMany` data bloğuna ekle:

```ts
        mileageAtIntake: newMileage,
        fuelLevelAtIntake: newFuel,
```

5. `AuditLogAction` metadata'sındaki `before`/`after` nesnelerine ekle:

```ts
      before: {
        customerComplaint: intake.customerComplaint,
        internalNote: intake.internalNote,
        mileageAtIntake: intake.mileageAtIntake,
        fuelLevelAtIntake: intake.fuelLevelAtIntake,
      },
      after: {
        customerComplaint: newComplaint,
        internalNote: newNote,
        mileageAtIntake: newMileage,
        fuelLevelAtIntake: newFuel,
      },
```

Yeni timeline event tipi ekleme — mevcut `intake_details_edited` olayı değişiklik listesini zaten metne basıyor.

- [ ] **Step 2: PATCH rotasını genişlet**

`src/app/api/intakes/[id]/route.ts` içinde `updateIntakeDetailsAction` çağrısına ekle:

```ts
    const result = await updateIntakeDetailsAction(id, {
      customerComplaint: body.customerComplaint,
      internalNote: body.internalNote,
      mileageAtIntake: body.mileageAtIntake,
      fuelLevelAtIntake: body.fuelLevelAtIntake,
    })
```

- [ ] **Step 3: Sunucu sayfasından veriyi geçir**

`src/app/(app)/orders/[id]/page.tsx` — `mileageAtIntake: intakeForm.mileageAtIntake,` geçen **her iki** yere (satır ~180 ve ~206) hemen altına ekle:

```ts
      fuelLevelAtIntake: intakeForm.fuelLevelAtIntake,
```

- [ ] **Step 4: İstemci tipini ve düzenleme durumunu güncelle**

`src/components/orders/work-order-detail.tsx`:

1. `intake` prop tipinde `mileageAtIntake: number | null` satırının (satır ~132) altına:

```ts
  fuelLevelAtIntake: number | null
```

2. `editMileage` state'inin yanına yeni state ekle:

```tsx
const [editFuelLevel, setEditFuelLevel] = useState<number | null>(null)
```

3. `startEditInfo` içine (satır ~280 altına):

```ts
    setEditFuelLevel(order.intake.fuelLevelAtIntake ?? null)
```

4. `handleSaveInfo` gövdesindeki JSON'a ekle:

```ts
        body: JSON.stringify({
          customerComplaint: editComplaint,
          internalNote: editNote,
          mileageAtIntake: editMileage,
          fuelLevelAtIntake: editFuelLevel,
        }),
```

5. Import ekle: `import { FuelGauge, FuelLevelPicker } from "@/components/intake/fuel-gauge"` ve `import { formatFuelLevel } from "@/lib/fuel-level"`.

- [ ] **Step 5: Araç meta satırında göster**

Aynı dosyada araç bilgisi satırına (satır ~626-630) `Giriş KM`'nin yanına ekle:

```tsx
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {order.intake.mileageAtIntake != null && <span>Giriş KM: {order.intake.mileageAtIntake.toLocaleString("tr-TR")}</span>}
                    {order.intake.fuelLevelAtIntake != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <FuelGauge value={order.intake.fuelLevelAtIntake} size="sm" showLabel={false} />
                        Yakıt: {formatFuelLevel(order.intake.fuelLevelAtIntake)}
                      </span>
                    )}
                    {order.vehicle.mileage != null && <span>Kayıtlı: {order.vehicle.mileage.toLocaleString("tr-TR")} km</span>}
                    {order.vehicle.vin && <span className="font-mono">VIN: {order.vehicle.vin}</span>}
                  </div>
```

- [ ] **Step 6: Düzenleme formuna seçiciyi ekle**

Aynı dosyada "Kilometre (kabul anı)" alanının (satır ~666-669) hemen altına:

```tsx
                  <div>
                    <Label>Yakıt seviyesi (kabul anı)</Label>
                    <div className="pt-1">
                      <FuelLevelPicker value={editFuelLevel} onChange={setEditFuelLevel} />
                    </div>
                  </div>
```

- [ ] **Step 7: Elle doğrula**

1. Yakıt seçili bir iş emrini aç → araç satırında küçük kadran + "Yakıt: 1/2" görünmeli.
2. "Şikayet & Notlar" kartında "Düzenle" → seçiciyi "3/4" yap → "Kaydet" → sayfa yenilenince meta satırı güncellenmeli.
3. "İşlem Geçmişi"nde `İş emri bilgileri düzenlendi (yakıt seviyesi)` satırı görünmeli.
4. Seçiliyken aynı kademeye tekrar dokunup kaydet → değer temizlenmeli, meta satırından yakıt kaybolmalı.
5. Teslim edilmiş bir iş emrinde "Düzenle" butonunun çıkmadığını doğrula (mevcut `orderLocked` davranışı).

- [ ] **Step 8: Doğrula ve commit**

Run: `bun run typecheck && bun run lint`

```bash
git add "src/app/(app)/intakes/actions.ts" "src/app/api/intakes/[id]/route.ts" "src/app/(app)/orders/[id]/page.tsx" src/components/orders/work-order-detail.tsx
git commit -m "feat(orders): iş emrinde yakıt seviyesi gösterimi ve düzenleme"
```

---

### Task 5: Müşteriye açık kabul özeti ve PDF

**Files:**
- Modify: `src/lib/intake/data-safety.ts` (tip ~satır 4-10, girdi tipi ~48-52, çıktı ~151-158)
- Modify: `src/components/intake/public-share-page.tsx` (tip ~satır 19, render ~257-261)
- Modify: `src/app/s/[token]/pdf/route.ts` (~satır 284)

**Interfaces:**
- Consumes: `formatFuelLevel`, `fuelGaugeSvgMarkup` (Task 1), `<FuelGauge>` (Task 2)
- Produces: `SafeIntakeData.fuelLevelAtIntake: number | null`

- [ ] **Step 1: data-safety allowlist'ine alanı ekle**

`src/lib/intake/data-safety.ts` içinde üç yere ekle — bu dosya açık izin listesidir, eksik bırakılırsa alan müşteriye hiç ulaşmaz:

1. `SafeIntakeData` tipinde `mileageAtIntake: number | null` altına:
```ts
  fuelLevelAtIntake: number | null
```
2. `sanitizeIntakeForPublic` parametre tipinde aynı satırın altına aynı alanı ekle.
3. `return { ... }` bloğunda (`mileageAtIntake: intake.mileageAtIntake,` altına):
```ts
    fuelLevelAtIntake: intake.fuelLevelAtIntake,
```

- [ ] **Step 2: Public sayfada göster**

`src/components/intake/public-share-page.tsx`:

1. `intakeForm` prop tipinde `mileageAtIntake: number | null` altına `fuelLevelAtIntake: number | null` ekle.
2. Import: `import { FuelGauge } from "@/components/intake/fuel-gauge"` ve `import { formatFuelLevel } from "@/lib/fuel-level"`.
3. Kilometre satırının (satır ~257-261) hemen altına:

```tsx
                {intakeForm.fuelLevelAtIntake != null && (
                  <div className="text-muted-foreground mt-1 flex items-center gap-2">
                    <FuelGauge value={intakeForm.fuelLevelAtIntake} size="sm" showLabel={false} />
                    <span>Kabulde yakıt: {formatFuelLevel(intakeForm.fuelLevelAtIntake)}</span>
                  </div>
                )}
```

- [ ] **Step 3: PDF'e kadranı göm**

`src/app/s/[token]/pdf/route.ts`:

1. Import'lara ekle: `import { fuelGaugeSvgMarkup, formatFuelLevel } from "@/lib/fuel-level"`
2. Kilometre satırının (satır ~284) hemen altına:

```ts
        ${intakeForm.fuelLevelAtIntake != null ? `<div style="display:flex;align-items:center;gap:6px;font-size:9px;color:#666;margin-top:2px;">${fuelGaugeSvgMarkup(intakeForm.fuelLevelAtIntake, 44)}<span>Kabulde yakıt: ${formatFuelLevel(intakeForm.fuelLevelAtIntake)}</span></div>` : ""}
```

Değer sayısal ve `sanitizeIntakeForPublic`'ten geldiği için ek escape gerekmez (metin enterpolasyonu yok).

- [ ] **Step 4: Elle doğrula**

1. İş emrinde "Müşteri Çıktısı" → paylaşım linki oluştur → `/s/<token>` aç: kadran + "Kabulde yakıt: 3/4" görünmeli.
2. Aynı sayfadan PDF indir: kadran PDF'te de çizilmeli (SVG bozuk görünüyorsa `viewBox`/`xmlns` kontrol et).
3. Yakıt seçilmemiş bir kabulün public sayfasında yakıt satırının **hiç** olmadığını doğrula.

- [ ] **Step 5: Doğrula ve commit**

Run: `bun run typecheck && bun run lint`

```bash
git add src/lib/intake/data-safety.ts src/components/intake/public-share-page.tsx "src/app/s/[token]/pdf/route.ts"
git commit -m "feat(public): kabul özeti ve PDF'te yakıt seviyesi"
```

---

### Task 6: Araç detayı ve araç pasaportu

Üç ayrı yüzey var, karıştırma:
- `vehicle-detail.tsx` → personel `/vehicles/[id]`, ham `intakes` prop'u ile besleniyor.
- `vehicle-passport.tsx` → personel `/vehicles/[id]/passport`, yine ham `intakes` (satır 153: `const workOrders = intakes.filter((i) => i.order)`).
- `public-vehicle-passport.tsx` + `p/[token]/pdf` → müşteriye açık; veriyi **yalnızca** `sanitizePassportForPublic` çıktısındaki `workOrders` üzerinden alır.

**Files:**
- Modify: `src/components/vehicles/vehicle-detail.tsx` (intake tipi ~satır 85-92, iş emri satırı ~306-335)
- Modify: `src/components/vehicles/vehicle-passport.tsx` (intake tipi ~satır 83, iş emri satırı ~316-343)
- Modify: `src/app/(app)/vehicles/[id]/passport/page.tsx:81` (veri geçişi)
- Modify: `src/lib/passport/data-safety.ts` (`SafePassportWorkOrder` ~satır 33-44, girdi tipi ~113-127, `workOrders` map'i ~204-245)
- Modify: `src/components/vehicles/public-vehicle-passport.tsx` (iş emri kartı ~satır 291-307)
- Modify: `src/app/p/[token]/pdf/route.ts` (iş emri HTML'i ~satır 59-68, veri geçişi ~satır 317)

**Interfaces:**
- Consumes: `<FuelGauge>` (Task 2), `formatFuelLevel` / `fuelGaugeSvgMarkup` (Task 1)
- Produces: `SafePassportWorkOrder.fuelLevelAtIntake: number | null`

- [ ] **Step 1: Personel araç detayında göster**

`src/components/vehicles/vehicle-detail.tsx`:

1. `intakes` dizisinin tipinde (satır ~88) `mileageAtIntake: number | null` altına `fuelLevelAtIntake: number | null` ekle.
2. Import: `import { FuelGauge } from "@/components/intake/fuel-gauge"`.
3. İş emri satırında (satır ~321) şikayet paragrafını şununla değiştir:

```tsx
                        <div className="mt-1 flex items-center gap-2">
                          {i.fuelLevelAtIntake != null && (
                            <FuelGauge value={i.fuelLevelAtIntake} size="sm" showLabel={false} className="shrink-0" />
                          )}
                          <p className="text-xs text-muted-foreground truncate">{i.customerComplaint}</p>
                        </div>
```

Bu sayfayı besleyen sunucu bileşeni (`src/app/(app)/vehicles/[id]/page.tsx`) `intakes`'i explicit `select` ile çekiyorsa `fuelLevelAtIntake: true` ekle; `include` kullanıyorsa ek iş yok.

- [ ] **Step 2: Personel araç pasaportunda göster**

1. `src/app/(app)/vehicles/[id]/passport/page.tsx:81` — `mileageAtIntake: i.mileageAtIntake,` satırının altına:
```ts
      fuelLevelAtIntake: i.fuelLevelAtIntake,
```
2. `src/components/vehicles/vehicle-passport.tsx`: `intakes` tipine (satır ~83) `fuelLevelAtIntake: number | null` ekle, `FuelGauge`'i import et ve iş emri satırındaki şikayet paragrafını (satır ~332) Step 1'deki blokla aynı şekilde sar.

- [ ] **Step 3: Pasaport allowlist'ine ekle**

`src/lib/passport/data-safety.ts`:

1. `SafePassportWorkOrder` tipine (satır ~33-44) ekle:
```ts
  fuelLevelAtIntake: number | null
```
2. `sanitizePassportForPublic` girdi tipindeki `intakes` dizisine (satır ~115, `mileageAtIntake: number | null` altına) aynı alanı ekle.
3. `workOrders` map'inin `return { ... }` bloğuna (satır ~228 civarı, `workOrderNo` ile aynı nesne) ekle:
```ts
            fuelLevelAtIntake: i.fuelLevelAtIntake,
```

`i` burada intake, `order` değil — yakıt seviyesi kabul formunda tutuluyor.

- [ ] **Step 4: Public pasaport sayfasında göster**

`src/components/vehicles/public-vehicle-passport.tsx` — iş emri kartında şikayet paragrafını (satır ~307) şununla değiştir:

```tsx
                  <div className="mb-2 flex items-center gap-2">
                    {wo.fuelLevelAtIntake != null && (
                      <FuelGauge value={wo.fuelLevelAtIntake} size="sm" showLabel={false} className="shrink-0" />
                    )}
                    <p className="text-sm text-muted-foreground">{wo.customerComplaint}</p>
                  </div>
```

Import: `import { FuelGauge } from "@/components/intake/fuel-gauge"`.

- [ ] **Step 5: Public pasaport PDF'ine ekle**

`src/app/p/[token]/pdf/route.ts`:

1. Import: `import { fuelGaugeSvgMarkup, formatFuelLevel } from "@/lib/fuel-level"`
2. Satır ~317'deki `mileageAtIntake: i.mileageAtIntake,` altına `fuelLevelAtIntake: i.fuelLevelAtIntake,` ekle (bu, `sanitizePassportForPublic`'e giden ham veri).
3. İş emri HTML bloğunda (satır ~66) şikayet satırını şununla değiştir:

```ts
        <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:#333;margin-bottom:4px;">${wo.fuelLevelAtIntake != null ? `${fuelGaugeSvgMarkup(wo.fuelLevelAtIntake, 36)}<span style="color:#666;">Yakıt: ${formatFuelLevel(wo.fuelLevelAtIntake)}</span>` : ""}<span>${wo.customerComplaint}</span></div>
```

- [ ] **Step 6: Elle doğrula**

1. `/vehicles/<id>` → iş emri geçmişinde yakıtı olan kayıtta küçük kadran görünmeli, uzun şikayet metni satırı bozmamalı.
2. `/vehicles/<id>/passport` → aynı gösterim.
3. Araç pasaportu paylaşım linki oluştur → `/p/<token>` ve PDF'inde kadranın çıktığını doğrula.
4. Yakıtı olmayan eski kayıtlarda hiçbir yerde boş kadran veya `%NaN` çıkmadığını doğrula.

- [ ] **Step 5: Doğrula ve commit**

Run: `bun run typecheck && bun run lint`

```bash
git add src/components/vehicles src/lib/passport/data-safety.ts "src/app/p/[token]" "src/app/(app)/vehicles"
git commit -m "feat(vehicles): araç detayı ve pasaportta yakıt seviyesi"
```

---

### Task 7: Nihai doğrulama ve PR

**Files:** —

- [ ] **Step 1: Tam doğrulama zinciri**

```bash
bun install
bun run lint
bun run typecheck
bun run build
```

Expected: dördü de hatasız. `build` başarısız olursa (özellikle SVG/`stroke-muted` gibi Tailwind sınıflarında) hatayı düzelt, sonraki adıma geçme.

- [ ] **Step 2: Migration'ı AWS dev'e uygula**

Ayrı terminalde tünel açık olacak şekilde:

```bash
bun run db:tunnel      # ayrı terminal, açık kalsın
bun run db:deploy
```

Expected: `add_fuel_level_at_intake` uygulandı. `migrate status` ile teyit et.

- [ ] **Step 3: Mobil genişlikte son kontrol**

Tarayıcıyı 360 px genişliğe daralt ve şunları doğrula:
- Kabul Adım 3'te 5 kademe butonu tek satırda taşmadan sığıyor, dokunma hedefleri `h-9`.
- İş emri araç meta satırında kadran satırı bozmuyor.
- Public sayfada kadran + metin alt alta düşmüyor/taşmıyor.

- [ ] **Step 4: PR aç**

```bash
git push -u origin feat/fuel-level-at-intake
gh pr create --base dev --title "feat: araç kabulünde yakıt seviyesi (ibre + zorunlu foto)" --body "$(cat <<'EOF'
## Ne değişti
- Kabulde yakıt seviyesi (E · 1/4 · 1/2 · 3/4 · Full) seçimi — `VehicleIntakeForm.fuelLevelAtIntake` (yüzde olarak saklanır)
- Yeni zorunlu foto tipi: `fuel_gauge` ("Yakıt göstergesi")
- Araç göstergesine benzeyen SVG kadran bileşeni; iş emri, araç detayı, pasaport, public özet ve PDF çıktılarında gösterim

## Risk alanları
- **Migration:** iki geri-uyumlu DDL (nullable kolon + enum değeri). Backfill yok.
- **Geriye dönük etki:** zorunlu foto 5 → 6 olduğu için eski kabullerin foto tamamlanma oranı düşer ve "Eksik: Yakıt göstergesi" rozeti görünür. Bilinçli karar.
- **Müşteri görünürlüğü:** yakıt seviyesi bilinçli olarak public sayfa ve PDF'te gösteriliyor (data-safety allowlist'lerine eklendi).

## Manuel QA
- [ ] Kabulde yakıt seç → DB'de doğru değer (0 seçildiğinde NULL değil, 0)
- [ ] Seçim yapılmayan kabulde hiçbir yüzeyde yakıt satırı yok
- [ ] İş emrinde düzenleme + denetim kaydı
- [ ] Public sayfa ve PDF'te kadran
- [ ] 360 px genişlikte taşma yok

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notlar

- **Spec'ten sapma:** Spec `formatFuelLevel`'ı `src/lib/format.ts`'e koyuyordu; plan tüm yakıt domain mantığını (değer kümesi, doğrulama, ibre geometrisi, PDF SVG) tek modülde topladığı için `src/lib/fuel-level.ts` içinde duruyor. `format.ts` genel amaçlı biçimlendirici olarak kalır.
- **0 tuzağı:** `fuelLevelAtIntake = 0` ("E") geçerli bir ölçümdür. Kod tabanında km için yaygın olan `value || null` kalıbı bu alanda **kullanılamaz**; her yerde `?? null` ve `!= null` kullan.
- **Enum genişletme:** Yeni `VehiclePhotoType` değeri eklendiği için `PHOTO_TYPES`'ı `Record<VehiclePhotoType, …>` gibi tüketen bir yer varsa TypeScript hatası verir — `bun run typecheck` bunu yakalar.
