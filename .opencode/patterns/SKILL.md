---
name: bakimx-patterns
description: BakimX Next.js 16 App Router tasarim pattern'leri ve shadcn/ui (base-ui) kurallari. Use when writing or modifying BakimX UI, forms, server actions, pages, or Prisma queries. Front-load keywords: shadcn, AppShell, FormField, useForm, zodResolver, requireAuth, workshopId, revalidatePath, validations, actions.ts, useActionState, Select onValueChange, Button render, Toast sonner, Alert destructive, Card, KpiCards, ActionsMenu, BrandLogo, marka dili, navy, brand, --color-deep.
---

# BakimX Design Patterns

Bu skill BakimX kod tabaninda uygulanan tek kaynak tasarim rehberidir. Kod yazmadan once ilgili bolume bakin; mevcut pattern'leri aynen uygulayin. AGENTS.md ile birlikte okuyun — bu skill somut yapilari (dosya yerleri, kod iskeletleri) verir, AGENTS.md soyut kurallari (raw HTML yasagi, tema token'lari) tekrarlar.

## 1. Dizin Yapisi

### 1.1 Route klasor kalibi (her entity icin)

```
src/app/app/<entity>/
├── page.tsx              # Liste (Server Component, async)
├── actions.ts            # "use server" — tum server action'lar burada
├── new/page.tsx          # Olusturma formu sayfasi (Server Component)
└── [id]/
    ├── page.tsx          # Detay goruntuleme (Server Component)
    └── edit/page.tsx     # Duzenleme formu sayfasi (Server Component)
```

### 1.2 Component klasor kalibi

```
src/components/app/
├── app-shell.tsx         # Sidebar + topbar (client, tum /app sayfalari bunu sarar)
├── <entity>-list.tsx     # Liste (client) — masaustu <table> + mobil kart
├── <entity>-detail.tsx   # Detay (client)
├── <entity>-form.tsx     # Duzenleme formu (client)
├── <entity>-create-form.tsx  # Olusturma formu (client)
├── actions-menu.tsx      # Paylasilan satir dropdown menu
├── status-badge.tsx      # StatusBadge / PaymentBadge / PlateBadge
├── kpi-cards.tsx         # KpiCards / KpiCardsLinked — KPI grid
├── filter-select.tsx     # Server-rendered GET filtre icin <Select> wrapper
└── dashboard/ reports/ analytics/ settings/  # Alan ozlu alt klasorler
```

### 1.3 Lib klasor kalibi

```
src/lib/
├── db.ts                 # prisma client (PrismaPg adapter, global singleton)
├── auth.ts               # requireAuth / getCurrentUser / assertWorkshopAccess
├── session.ts            # iron-session
├── audit.ts              # AuditLogAction(...)
├── format.ts             # formatTRY / formatNumber / normalizePhone / customerDisplayName (server)
├── utils-client.ts       # formatDate / formatDateTime (client-safe)
├── utils.ts              # cn() — clsx + tailwind-merge
├── constants.ts          # ORDER_STATUS / PAYMENT_STATUS / DAMAGE_TYPES / VEHICLE_ZONES
├── validation.ts         # LEGACY monolith (zod/v4) — yeni seyler icin KULLANMA
└── validations/<entity>.ts   # Yeni zod semalari (plain zod import) — yeni seyler BURADA
    └── lib/<domain>/queries.ts  # Paylasilan Prisma sorgu yardimcilari (async fn, "use server" DEGIL)
```

### 1.4 Dosya isimlendirme

- Dosya: kebab-case (`part-form.tsx`, `customer-list.tsx`)
- Export: PascalCase (`PartForm`, `CustomerList`)
- Server action: `<verb><Entity>Action` (`createPartAction`, `updatePartAction`, `deactivatePartAction`, `deletePartAction`)
- Query yardimci: `get<Entity><Qualifier>` (`getPartKPIs`, `getActiveWorkOrders`)
- UI string'leri: Turkce (hata mesajlari dahil)

## 2. Sayfa Iskeleti (Server Component)

Her authenticated sayfa su sirayi izler:

```tsx
// src/app/app/<entity>/page.tsx — Server Component
import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { EntityList } from "@/components/app/entity-list"

export default async function EntityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const { user, workshop } = await getAppData()
  const sp = await searchParams
  const workshopId = user.workshopId

  const where: Prisma.EntityWhereInput = { workshopId }
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, /* ... */]
  if (sp.status) where.status = sp.status

  const items = await prisma.entity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { /* gerekli relationlar */ },
  })

  // Serilestirme: Date -> ISO string, Prisma nesnesi -> plain object
  const serializable = items.map((x) => ({
    ...x,
    createdAt: x.createdAt.toISOString(),
    updatedAt: x.updatedAt.toISOString(),
  }))

  return (
    <AppShell workshopName={workshop?.name ?? ""} pageTitle="...">
      {/* Breadcrumb (hand-written, PageHeader komponenti YOK) */}
      <div className="flex items-center text-sm text-muted-foreground mb-3">
        <Link href="/app">Kontrol Paneli</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Parcalar</span>
      </div>

      {/* Baslik bloku (hand-written) */}
      <h2 className="text-xl sm:text-2xl font-bold text-foreground">...</h2>
      <p className="text-sm text-muted-foreground mt-0.5 mb-5">...</p>

      {/* Icerik */}
      <EntityList items={serializable} />
    </AppShell>
  )
}
```

### 2.1 `getAppData()`

`src/app/app/data.ts` (`"use server"`) uzerinden:
```ts
const { user, workshop } = await getAppData()
// user.workshopId ile scope yap
```
Auth yoksa otomatik `/login`'e redirect. Sayfa basinda cagirilir, tek seferde auth + workshop context verir.

### 2.2 Yeni sayfa olustururken

- `<AppShell>` sarmalini unutma — `pageTitle`, `workshopName`, `pageActions`, `showGlobalSearch` proplari alir.
- Breadcrumb + baslik bloku hand-written pattern'ini koru — `PageHeader` komponenti olusturma.
- `notFound()` — entity bulunamazsa `next/navigation`'dan cagir.
- Server/Client ayreri: sayfa Server Component, interaktif kisim ayri client komponente gitsin. `Date` ve Prisma nesnelerini asla dogrudan client'a paslama — `.toISOString()` ile serilestir.

## 3. Form Pattern (Client Component)

Tum formlar react-hook-form + zod + shadcn Form + useActionState kullanir. **`useState` ile form state YONETME.**

### 3.1 Zod sema

```ts
// src/lib/validations/<entity>.ts
import { z } from "zod"

export const entitySchema = z.object({
  name: z.string().min(1, "Ad zorunludur"),
  count: z.coerce.number().min(0).default(0),
  currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  optional: z.string().optional().default(""),
})
export type EntityFormValues = z.infer<typeof entitySchema>
```

### 3.2 Form komponent iskeleti

```tsx
"use client"
import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import { entitySchema, type EntityFormValues } from "@/lib/validations/entity"
import { createEntityAction, updateEntityAction } from "@/app/app/entity/actions"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

type ActionState = { error?: string; success?: boolean; id?: string } | null

export function EntityForm({ entity }: { entity?: EntityData }) {
  const router = useRouter()
  const isEdit = !!entity
  const form = useForm<EntityFormValues>({
    resolver: zodResolver(entitySchema),
    defaultValues: isEdit ? toDefaults(entity) : emptyDefaults,
  })

  const action = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
    if (isEdit && entity) return updateEntityAction(entity.id, formData) as Promise<ActionState>
    return createEntityAction(formData) as Promise<ActionState>
  }
  const [state, formAction, pending] = useActionState(action, null as ActionState)

  useEffect(() => {
    if (state?.success && state.id) router.push(`/app/entity/${state.id}`)
  }, [state, router])

  function onSubmit(values: EntityFormValues) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(values)) fd.set(k, String(v))
    formAction(fd)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Alanlar Card icinde gruplanir */}
        <Card>
          <CardHeader><CardTitle>Genel Bilgiler</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad *</FormLabel>
                  <FormControl><Input {...field} placeholder="..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

            {/* Select: onValueChange (value: string | null) alir */}
            <FormField control={form.control} name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Para Birimi</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "TRY")}>
                      <SelectTrigger className="w-full h-8"><SelectValue placeholder="Para Birimi" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRY">TL TRY</SelectItem>
                        <SelectItem value="USD">$ USD</SelectItem>
                        <SelectItem value="EUR">€ EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </CardContent>
        </Card>

        {/* Submit (masaustu) */}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            {isEdit ? "Guncelle" : "Olustur"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Vazgec</Button>
        </div>
      </form>
    </Form>
  )
}
```

### 3.3 Mobil sticky submit bar

Formlarda mobilde sabit alt cubuk kullan:
```tsx
<div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border p-3 flex gap-2 safe-area-bottom">
  <Button type="submit" disabled={pending} className="flex-1">...</Button>
</div>
```

### 3.4 Dinamik dizi (line items)

`useFieldArray` kullan — manuel array state YONETME:
```tsx
import { useFieldArray } from "react-hook-form"
const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
```

### 3.5 Cok adimli sihirbaz

Tek `useForm` tum adimlar icin, adim bazli validasyon:
```tsx
const valid = await form.trigger(["field1", "field2"])
if (valid) setStep(step + 1)
```

## 4. Server Action Pattern

### 4.1 Iskelet

```ts
// src/app/app/<entity>/actions.ts
"use server"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { entitySchema } from "@/lib/validations/entity"
import { getValidationError } from "@/lib/validation"
import { AuditLogAction } from "@/lib/audit"

export async function createEntityAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  // Form verisini topla
  const raw: Record<string, string> = {}
  for (const f of ["name", "currency", "count"]) {
    const v = formData.get(f)
    if (v && typeof v === "string") raw[f] = v
  }

  // Validasyon
  const parsed = entitySchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  // Relation scope kontrolu (cross-tenant engelle)
  if (parsed.data.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: parsed.data.supplierId, workshopId },
    })
    if (!supplier) return { error: "Gecersiz tedarikci" }
  }

  // Olustur
  const entity = await prisma.entity.create({ data: { workshopId, ...parsed.data } })

  // Audit
  await AuditLogAction(workshopId, user.id, "Entity", entity.id, "entity_created")

  // Cache invalidate (revalidatePath, revalidateTag DEGIL)
  revalidatePath("/app/entity")
  return { success: true, id: entity.id }
}

export async function updateEntityAction(id: string, formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId
  // ... validation
  // Scope: updateMany kullan (workshopId ile)
  await prisma.entity.updateMany({ where: { id, workshopId }, data: parsed.data })
  revalidatePath(`/app/entity/${id}`)
  revalidatePath("/app/entity")
  return { success: true, id }
}

export async function deleteEntityAction(id: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId
  // Referans kontrolu
  const usage = await prisma.order.count({ where: { entityId: id, workshopId } })
  if (usage > 0) return { error: "Bu kayit kullaniliyor, silinemez" }
  await prisma.entity.deleteMany({ where: { id, workshopId } })
  revalidatePath("/app/entity")
  return { success: true }
}
```

### 4.2 Kurallar

- Ilk satir: `const user = await requireAuth()` → `workshopId = user.workshopId`
- Validasyon: `schema.safeParse(raw)` → hata: `{ error: getValidationError(parsed) }`
- Scope: her sorguda `workshopId` zorunlu. `findFirst({ where: { id, workshopId } })` / `updateMany` / `deleteMany` kullan (cross-tenant engel).
- Referans kontrolu silmeden once (`prisma.x.count`).
- Audit: her mutation sonrasi `AuditLogAction(workshopId, userId, "Entity", entityId, "action_string")`.
- Cache: `revalidatePath("/app/entity")` ve `revalidatePath(`/app/entity/${id}`)`. **`revalidateTag` KULLANMA.**
- Donus: hata `{ error: string }`, basari `{ success: true, id?: string }`.
- Action client'ten iki sekilde cagrilir: (1) `useActionState` ile form submit, (2) `await import()` sonra direkt cagri (satir aksiyonlari, silme).

## 5. Liste Komponenti (Client)

```tsx
"use client"
export function EntityList({ items }: { items: EntityRow[] }) {
  const router = useRouter()
  const [q, setQ] = useState("")

  async function handleDelete(id: string) {
    const { deleteEntityAction } = await import("@/app/app/entity/actions")
    const res = await deleteEntityAction(id) as { error?: string }
    if (res?.error) toast.error(res.error)
    else router.refresh()
  }

  return (
    <>
      {/* Filtre cubugu */}
      <div className="flex gap-2 mb-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara..." />
        <Button onClick={() => router.push(`/app/entity?q=${encodeURIComponent(q)}`)}>Filtrele</Button>
      </div>

      {/* Masaustu tablo (hidden md:block) */}
      <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="text-left p-3 font-medium text-muted-foreground">Ad</th>
              {/* ... */}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((x) => (
              <tr key={x.id} className="hover:bg-muted/50">
                <td className="p-3">{x.name}</td>
                <td className="p-3 text-right"><ActionsMenu ... /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil kart listesi */}
      <div className="md:hidden space-y-2">
        {items.map((x) => (
          <div key={x.id} className="rounded-lg border border-border bg-card p-3">
            {/* ... */}
          </div>
        ))}
      </div>

      {/* Bos durum (inline, EmptyState komponenti YOK) */}
      {items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Kayit bulunamadi</p>
          <Button asChild className="mt-4"><Link href="/app/entity/new">Yeni Ekle</Link></Button>
        </div>
      )}
    </>
  )
}
```

### 5.1 Kurallar

- `DataTable` komponenti YOK — tablo hand-rolled, `hidden md:block` + `md:hidden` ikili sini kullan.
- `EmptyState` komponenti YOK — bos durum inline (icon + iki `<p>` + CTA).
- `KpiStat` komponenti YOK — `KpiCards` veya inline lokal yardimci kullan.
- Satir aksiyonlari `ActionsMenu` / `MobileActionsMenu` ile (`<DropdownMenu>` bazli).
- Toast: `toast.success()` / `toast.error()` (sonner) — gecici bildirim. Kalici hata → `<Alert variant="destructive">`.

## 6. shadcn/ui Kurallari (base-ui bazli)

### 6.1 Raw HTML interaktif element YASAK

| Ihtiyac | Kullan | Yasak |
|---|---|---|
| Button | `<Button>` | `<button>` |
| Text input | `<Input>` | `<input>` |
| Select | `<Select>` + `SelectTrigger/Content/Item` | `<select>` |
| Textarea | `<Textarea>` | `<textarea>` |
| Checkbox | `<Checkbox>` | `<input type="checkbox">` |
| Radio | `<RadioGroup>` + `RadioGroupItem` | `<input type="radio">` |
| Tabs | `<Tabs>` + `TabsList/Trigger/Content` | `<nav>` + tab logic |
| Modal | `<Dialog>` veya `<Sheet>` | `fixed inset-0` div |
| Toggle group | `<ToggleGroup>` + `ToggleGroupItem` | buton gruplari |
| On/off switch | `<Switch>` | `<input type="checkbox">` |
| Hover hint | `<Tooltip>` | `title=` attribute |

### 6.2 Link as button

```tsx
// DOGRU
<Button nativeButton={false} render={<Link href="/app/parts/new" />}>Yeni Parca</Button>

// YANLIS
<Link href="/app/parts/new"><Button>Yeni Parca</Button></Link>
```

### 6.3 Component API ozellikleri (Next.js 16 / base-ui)

- **Button**: `render` prop (Radix `asChild` DEGIL). Link render icin `nativeButton={false}`.
- **Accordion**: Base UI API — `type` / `collapsible` prop'lari YOK.
- **Select**: `onValueChange` `(value: string | null)` alir. Handler'da `field.onChange(v ?? "default")` veya `v ?? ""` kullan. Asla `v!` non-null assertion yapma.
- **Form**: `@radix-ui/react-slot` transitif kullanir (Base UI Form DEGIL). `<FormControl>` Slot sarmalar.
- **Toast**: `<Toaster />` root layout'ta. Cagri: `toast.success("...")` / `toast.error("...")`.

### 6.4 Tema token'lari

Tailwind v4 CSS-first config (`globals.css`'te `@theme inline`). **Hardcoded renk YASAK.**

| Token | Kullanim | Yasak ornek |
|---|---|---|
| `bg-primary` / `text-primary-foreground` | Ana aksiyon butonu | `bg-blue-600` |
| `bg-destructive` / `text-destructive` | Silme, hata | `bg-red-600` |
| `bg-muted` / `text-muted-foreground` | Pasif, ikincil metin, tablo baslik | `bg-slate-100` |
| `border-border` | Kenarlik | `border-gray-200` |
| `ring-ring` / `outline-ring` | Focus halkasi | `ring-blue-500` |
| `bg-card` / `text-card-foreground` | Kart arka plan | `bg-white` |
| `bg-success` / `text-success-foreground` | Basari (custom) | `bg-emerald-600` |
| `bg-warning` / `text-warning-foreground` | Uyari (custom) | `bg-amber-100` |
| `bg-accent` / `text-accent-foreground` | Hover vurgu | — |
| `bg-secondary` / `text-secondary-foreground` | Ikincil buton | — |
| `bg-popover` / `text-popover-foreground` | Popover / dropdown | — |

**Marka renkleri** (`@theme inline` icinde, logodan cikarildi):

| Token | Hex | Kullanim |
|---|---|---|
| `bg-navy` / `text-navy-foreground` | `#071F49` | Lacivert arka plan (login sol panel, dashboard hero kart) |
| `bg-navy-light` | `#031432` | Lacivert gradient sonu (`from-navy to-navy-light`), koyu sidebar bg |
| `text-brand` / `bg-brand` | `#2F84FF` | Marka blue'su, vurgu rengi (auth-visual-panel accent cizgisi) |
| `--primary` (light) | `#0865E8` (OKLCH `oklch(0.585 0.212 258)`) | Ana aksiyon rengi (butonlar, linkler, focus ring) |
| `--primary` (dark) | `#2F84FF` (OKLCH `oklch(0.65 0.215 254)`) | Dark mode ana aksiyon |

Yeni UI elementlerinde varsayilan `primary`/`destructive`/`muted` kullan. Marka renkleri `navy`/`navy-light`/`brand` yalnizca marka amaclari icin (login panel, sidebar gradient, auth accent). **`bg-deep` KULLANMA** — kaldirildi, yerine `bg-navy-light`. Detay icin Bolum 7'ye bak.

### 6.5 Mevcut teknik borc (tekrarlama)

Su dosyalarda hardcoded renk ihlalleri var — yeni kod yazarken ayni hataya dusme:
- `src/components/app/app-shell.tsx`: `bg-blue-600 hover:bg-blue-700` topbar butonu
- `src/components/app/reports/reports-layout.tsx`: `text-blue-600`, `bg-blue-600`
- `src/components/app/part-detail.tsx`: `bg-emerald-600`, `bg-red-50`, `bg-amber-50` hareket renkleri
- `src/lib/constants.ts`: `ORDER_STATUS`, `PAYMENT_STATUS` raw `bg-slate-100`/`text-amber-800`/`bg-rose-50`/`bg-sky-50` renk map'leri

Yeni kod: `text-success`, `text-destructive`, `bg-success/10`, `bg-destructive/10`, `text-muted-foreground` kullan.

> Not: `src/app/globals.css` icindeki eski `--color-deep` (slate-950 taklidi, marka disi) G1 gorevi ile kaldirildi. `navy`/`navy-light`/`brand` degerleri logodan cikarildi (Bolum 7.2). Bu dosya artik marka uyumlu — yeni kodda `bg-deep` kullanma.

## 7. Marka Dili ve Logo

Bu bolum BakimX marka kimliginin kodlasmis hali. Logo dosyalari `public/` altinda, kullanim rehberi `public/BakimX_Logo_Kullanim_Rehberi.txt`. Marka renkleri logodan cikarildi ve tema token'larina map'lendi (Bolum 6.4).

### 7.1 Marka Adi

Marka adi HER ZAMAN "BakimX" yazilir — B buyuk, X buyuk, gerisi kucuk harf. Yasak: "Bakimx", "BAKIMX", "bakimx", "BakımX" (Turkce karakter YOK). Tum UI string'lerinde, metadata'da, alt text'lerde bu yazim kullan.

Ornekler:
- `<BrandLogo alt="BakimX" />` (degil "BakımX" veya "bakimx")
- `metadata.title = "BakimX — ..."`
- `manifest.json` `"name": "BakimX"` (su an dogru)
- Toast mesajlarinda "BakimX basariyla ..." (degil "bakimx")

### 7.2 Marka Renkleri

Logodan cikarildi, `globals.css` `@theme inline` icinde tema token'larina map'lendi:

| Token | Hex | Kullanim | Logo kaynak |
|---|---|---|---|
| `--color-navy` | `#071F49` | Lacivert arka plan (login sol panel, dashboard hero kart) | navy gradient baslangic |
| `--color-navy-light` | `#031432` | Lacivert gradient sonu (`from-navy to-navy-light`), koyu sidebar bg | navy gradient son |
| `--color-brand` | `#2F84FF` | Marka blue'su, vurgu rengi (auth-visual-panel accent cizgisi) | blue gradient baslangic |
| `--color-navy-foreground` | `#FFFFFF` | navy/light uzerinde text | — |
| `--primary` (light) | `#0865E8` (OKLCH `oklch(0.585 0.212 258)`) | Ana aksiyon rengi (butonlar, linkler, focus ring) | blue gradient orta |
| `--primary` (dark) | `#2F84FF` (OKLCH `oklch(0.65 0.215 254)`) | Dark mode ana aksiyon | blue gradient baslangic |

**Yasak** (marka disi, kullanma):
- `--color-deep` (kaldirildi, slate-950 taklidi, yerine `navy-light`)
- `bg-slate-950`, `bg-slate-900` (marka disi, yerine `bg-navy` veya `bg-navy-light`)
- `bg-blue-600`, `text-blue-600` (tailwind palette, yerine `bg-primary`/`text-primary`)
- `bg-sky-400`, `text-sky-400` (tailwind palette, yerine `bg-brand`/`text-brand` — marka brand token'i farkli)

### 7.3 Logo Sistemi (4 Parca)

| Variant | Dosya | Arka plan | Kullanim |
|---|---|---|---|
| `primary-light` | `01-bakimx-primary-light.svg` | Acik (beyaz, acik gri, acik renkli) | Header, landing, PDF, teklif, genis alanlar |
| `primary-dark` | `02-bakimx-primary-dark.svg` | Koyu (lacivert, siyah, fotograf ustu) | Login sol panel, dark mode, sunum kapagi |
| `icon-light` | `03-bakimx-icon-light.svg` | Acik | Favicon, app icon, dar sidebar, 40px alti |
| `icon-dark` | `04-bakimx-icon-dark.svg` | Koyu | Dark sidebar, koyu mobil header, 40px alti koyu zemin |

### 7.4 BrandLogo Komponenti

```tsx
import { BrandLogo } from "@/components/shared/brand-logo"

// Acik zemin, genis alan (landing header, PDF)
<BrandLogo variant="primary-light" size="lg" alt="BakimX" />

// Koyu zemin (login sol panel, dark footer)
<BrandLogo variant="primary-dark" size="lg" alt="BakimX" />

// Koyu sidebar, dar alan (40px alti otomatik icon'a duser)
<BrandLogo variant="icon-dark" size="md" alt="BakimX" />

// Favicon, app icon
<BrandLogo variant="icon-light" size="xs" alt="BakimX" />

// Clear-space gerekli (dar kullanim, kenar temas riski)
<BrandLogo variant="primary-light" size="lg" clearSpace alt="BakimX" />
```

**API**:
- `variant`: "primary-light" | "primary-dark" | "icon-light" | "icon-dark" (default "primary-light")
- `size`: "xs" (20px) | "sm" (24px) | "md" (32px) | "lg" (40px) (default "md")
- `clearSpace`: boolean (default false) — logo cevresinde X kolu kalinligi kadar padding
- `priority`: boolean (next/image, above-the-fold icin)
- `alt`: string (default "BakimX", her zaman "BakimX" yaz)
- `className`, `imgClassName`, `height` (override)

**Otomatik icon dususu**: size xs/sm/md (40px alti) ise variant otomatik icon-{light,dark}'a cevrilir. Rehber kurali: "40px altinda yalniz icon". Manual olarak size="sm" + variant="primary-light" yazsan bile komponent icon-light kullanir. Sadece size="lg" (40px+) primary kullanir.

### 7.5 Logo Kullanim Kurallari

1. **Marka adi "BakimX"** — alt text, metadata, UI string'lerinde her zaman bu yazim
2. **Genis alanda primary** — landing header, PDF, teklif, login sol panel. 40px+ size.
3. **40px altinda icon** — BrandLogo otomatik yapar. Manual zorlama.
4. **Koyu zeminde koyu logo** (primary-dark, icon-dark). Acik zeminde acik logo (primary-light, icon-light). Karistirma.
5. **Clear-space** — dar kullanimda `clearSpace` prop'unu true yap. Logo cevresinde en az ikon X kolu kalinligi (~ height * 0.08) bosluk.
6. **Oran koru** — `object-contain` (zaten default). Yeniden boyutlandirma AMA yeniden renklendirme YASAK. SVG renklerini CSS filter/opacity ile degistirme.
7. **Egme/rotate YASAK** — `transform: rotate/skew` logo'ya uygulama.

### 7.6 Marka Dili Uygulama Yerleri

| Yer | Variant | Size | Not |
|---|---|---|---|
| Landing header (acik) | primary-light | lg | Genis alan, primary tercih |
| Login sol panel (koyu) | primary-dark | lg | Rehber onerisi |
| Footer (koyu) | primary-dark | lg | — |
| Desktop sidebar (koyu, dar) | icon-dark | md | 40px alti, dar sidebar |
| Mobil sidebar (koyu) | icon-dark | md | — |
| Favicon | icon-light | xs | manifest.json'da tanimli |
| PDF header (acik) | primary-light | lg | clearSpace true |
| Public share page (acik, dar) | icon-light | sm | 40px alti |
| Vehicle passport (acik, dar) | icon-light | sm | 40px alti |

### 7.7 Yasak Listesi (Marka)

- [ ] Marka adini "Bakimx", "BAKIMX", "bakimx", "BakımX" yazma — her zaman "BakimX"
- [ ] Koyu zemine primary-light / icon-light koyma
- [ ] Acik zemine primary-dark / icon-dark koyma
- [ ] 40px altinda primary kullanma (BrandLogo otomatik engeller ama manual bypass yapma)
- [ ] `--color-deep` kullanma (kaldirildi, navy-light kullan)
- [ ] Tailwind palette blue/sky kullanma (`bg-blue-600`, `text-sky-400`) — `bg-primary`/`text-brand` (marka token) kullan
- [ ] `bg-slate-900`/`bg-slate-950` koyu arka plan icin kullanma — `bg-navy`/`bg-navy-light`
- [ ] Logo SVG'lerini CSS filter/opacity ile renklendirme
- [ ] Logo'ya rotate/skew transform uygulama
- [ ] Logo oranlarini bozma (width:height oranini degistirme — object-contain koru)
- [ ] Yeni logo variant uydurma (4 parca sabit)

## 8. Auth & Middleware

### 8.1 Auth yardimcilari (`src/lib/auth.ts`)

- `getCurrentUser(): Promise<AuthUser | null>` — session'dan user yukle.
- `requireAuth(): Promise<AuthUser>` — throws `"Unauthorized"` yoksa. Server action ilk satiri.
- `getCurrentUserWithWorkshop()` — user + workshop.
- `assertWorkshopAccess(entity, workshopId, label)` — sync, throws if null veya workshopId uyumsuz.
- `isAuthenticated()` — boolean, SSR auth sayfalari icin.

### 8.2 Middleware (`src/middleware.ts`)

- **Public path'ler**: `/`, `/login`, `/register`, `/forgot-password`, `/privacy`, `/terms`
- **Public prefix'ler**: `/s/`, `/p/`, `/api/auth`, `/api/demo-request`, `/api/support-request`, `/api/cron`
- `/app/*` icin: auth yoksa `/login?redirect=<path>`'e redirect
- `/api/*` icin: `protectedApiPaths` allowlist disinda 401 JSON
- Authenticated user `/login` veya `/register`'e gitse → `/app`'e redirect

### 8.3 Session

iron-session, cookie `bakimx_session`, 7 gun maxAge, dev secret fallback. `src/lib/session.ts`'te `getSession()`.

## 9. Prisma Kullanimi

- **Client**: `src/lib/db.ts` → `prisma` (PrismaPg adapter, global singleton)
- **Inline sorgu**: Server Component'lerde direkt `prisma.entity.findMany` vb.
- **Sorgu yardimcisi**: `src/lib/<domain>/queries.ts` icinde `async function` — paylasilan sorgular. `"use server"` DEGIL (sadece SC'lerde import).
- **Repository pattern YOK** — `repositories/` klasoru acma.
- **Scope**: her sorgu `workshopId` icermeli. `findFirst({ where: { id, workshopId } })` ile ownership dogrula.
- **Serilestirme**: `Date` → `.toISOString()`. Prisma nesnelerini client'a paslama. Client `lib/utils-client.ts`'ten `formatDate`/`formatDateTime` kullanir.

## 10. Yasak Listesi (Yeni Kod Icin)

- [ ] Raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<input type="checkbox/radio">`
- [ ] `fixed inset-0` manuel modal (`<Dialog>`/`<Sheet>` kullan)
- [ ] `title=` attribute (`<Tooltip>` kullan)
- [ ] `<Link><Button>...</Button></Link>` sarmalama
- [ ] Hardcoded renk (`bg-blue-600`, `text-emerald-600`, `bg-rose-50` vb.) — tema token kullan
- [ ] `useState` ile form state yonetimi (react-hook-form + zod kullan)
- [ ] Zod sema `src/lib/validation.ts` icinde (yeni sema `src/lib/validations/<entity>.ts`'e)
- [ ] `revalidateTag` (`revalidatePath` kullan)
- [ ] Cross-tenant sorgu (`workshopId` olmadan Prisma cagrisi)
- [ ] `as` non-null assertion (`!`) — ozellikle Select `onValueChange` value'sinde
- [ ] `any` tipi
- [ ] Prisma nesnesini client'a paslamak (serilestir)
- [ ] Server action'da audit log atlamadan mutation
- [ ] Yeni `PageHeader` / `DataTable` / `EmptyState` / `StatCard` komponenti olusturmak (mevcut hand-rolled pattern'i koru)
- [ ] Marka adini "Bakimx", "BAKIMX", "bakimx", "BakımX" yazma — her zaman "BakimX" (bkz. Bolum 7.7)
- [ ] `--color-deep` kullanma — kaldirildi, yerine `navy-light` (bkz. Bolum 7.7)

## 11. Tekrar Eden Komponent'ler (Yeniden Kullan)

Mevcut komponent varken yeni olusturma:

- `<AppShell>` — tum /app sayfalari icin shell
- `<ActionsMenu>` / `<MobileActionsMenu>` — satir aksiyon dropdown
- `<KpiCards>` / `<KpiCardsLinked>` — KPI grid (Linked versiyonu KPI'yi filtre linkine baglar)
- `<StatusBadge>`, `<PaymentBadge>`, `<PaymentMethodBadge>`, `<CollectionStatusBadge>`, `<PlateBadge>` (`status-badge.tsx`)
- `<FilterSelect>` — server-rendered GET filtre
- `<PrintButton>` — `window.print()` wrapper
- `<QuickActions>` — dashboard hizli aksiyon kutulari
- `<ComingSoonShell>` — yapim asamasinda olan route'lar icin placeholder
- `<BrandLogo>` — marka logosu, 4 variant + size + clearSpace (bkz. Bolum 7 Marka Dili ve Logo)

Domain-specific badge'lar (`StockStatusBadge`, `QuoteStatusBadge`, vb.) kendi dosyalarinda — once ara, yoksa olustur ama once `status-badge.tsx` ve `lib/constants.ts`'te renk map'i var mi kontrol et.

## 12. Package.json Scripts (Dogrulama)

Is bittikten sonra calistir:
- `bun run typecheck` (or `npm run typecheck`) — TypeScript hatasi yok
- `bun run lint` (or `npm run lint`) — ESLint hatasi yok

Build zorunlu degil ama buyuk degisiklikte `bun run build` calistir.

## 13. Tek Kaynak Onceligi

Cakisma durumunda oncelik sirasi:
1. AGENTS.md (kullanici duzeyinde soyut kurallar)
2. Bu skill (somut yapilar, dosya yerleri, kod iskeletleri)
3. Mevcut kod tabani (pattern'leri takip et, yeni pattern uydurma)

Eger bir pattern bu skill'de yoksa, en yakin mevcut uygulamayi bul ve onu kopyala. Yeni pattern uydurma — orkestratorden once sor.