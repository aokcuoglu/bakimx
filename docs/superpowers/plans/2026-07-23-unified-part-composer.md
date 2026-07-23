# Birleşik Parça Ekleme (Odoo-tarzı tek arama menüsü) — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş emri parça ekleme akışını, iki parça sekmesini (katalog + elle) tek Odoo-tarzı arama kutusuna birleştirerek sadeleştirmek.

**Architecture:** `PartsLaborGrid` içindeki 3 sekme 2'ye iner (`Parça` birleşik arama kutusu + `İşçilik` aynen). Parça composer'ı saf bir arama kutusudur: katalog eşleşmesi seçme / `Oluştur "X"` / `Oluştur & Düzenle` aksiyonlarının **hepsi doğrudan mevcut `addItem` POST'unu** çağırır; satır anında listeye düşer ve satır-içi düzenlenir. Şema/DB/sunucu değişikliği yoktur.

**Tech Stack:** Next.js (App Router, client component), TypeScript strict, Base UI tabanlı shadcn bileşenleri (`Autocomplete`, `Dialog`, `InputGroup`), Tailwind.

## Global Constraints

- **Şema/DB/sunucu değişikliği YOK.** Yalnız mevcut `POST /api/orders/items` (alanlar: `type`, `name`, `sku`, `unit`, `quantity`, `unitPrice`, `brand`, `category`, `categoryId`, `source`) kullanılır.
- **Parça fiyatı asla uydurulmaz** (dürüstlük kuralı): katalog seçiminde `unitPrice=null`, kullanıcı satırda girer.
- **Tenant izolasyonu**: yeni sunucu yolu yok; `addItem` mevcut korumaları kullanır — dokunma.
- **Dil**: tüm kullanıcı-görünür metin Türkçe. Fiyat = `formatTRY`; lira→kuruş = `liraToKurus` (`@/lib/money`).
- **Bileşen boyu**: `parts-labor-grid.tsx` zaten ~1230 satır; modal AYRI dosyada (`manual-part-dialog.tsx`).
- **Test altyapısı**: Repo'da React bileşen test harness'i YOK (tüm `*.test.ts` saf `bun test` fonksiyon testleri). Bu UI görevlerinde doğrulama = `bun run typecheck` + `bun run lint` (+ Task 3'te `bun run build`) + spec'teki manuel QA. Fabrikasyon bileşen testi YAZILMAZ.
- **İzole worktree**: iş `dev` tabanlı ayrı git worktree'de yapılır (paralel-oturum çakışma dersi).
- `bare` modda çalışan liste satırı `PartSearchInput` kullanımı create aksiyonlarını ASLA göstermemeli — yeni create prop'ları yalnız composer'dan geçilir.

---

## File Structure

- **Create** `src/components/app/manual-part-dialog.tsx` — "Oluştur & Düzenle" modalı (saf sunumsal + yerel state; `onSubmit(draft)` çağırır). Tek sorumluluk: manuel parça detaylarını odaklı bir formda toplamak.
- **Modify** `src/components/app/part-search-input.tsx` — dropdown'a her zaman görünen create aksiyonları (`Oluştur "X"` / `Oluştur & Düzenle`) + katalogsuz dalda da; yeni opsiyonel prop'lar `showCreate`/`onCreate`/`onCreateEdit`.
- **Modify** `src/components/app/parts-labor-grid.tsx` — 3→2 sekme; `CatalogComposer*`/`ManualComposer*` kaldır; yeni `UnifiedPartComposer` (arama kutusu → doğrudan `addItem` + modal); `EmptyItemsHint` metni.

---

## Task 1: `ManualPartDialog` bileşeni ("Oluştur & Düzenle" modalı)

**Files:**
- Create: `src/components/app/manual-part-dialog.tsx`

**Interfaces:**
- Consumes: `PartAttributeField` (`@/components/app/part-attribute-field`), `liraToKurus` (`@/lib/money`), `ui/dialog`, `ui/input-group`, `ui/button`, `ui/input`.
- Produces:
  - `export type ManualPartDraft = { name: string; brand: string | null; category: string | null; categoryId: number | null; quantity: number; unitPrice: number | null }`
  - `export function ManualPartDialog(props: { open: boolean; onOpenChange: (b: boolean) => void; initialName: string; vehicleTypeId: number | null; submitting: boolean; onSubmit: (d: ManualPartDraft) => void }): JSX.Element`
  - `onSubmit`'in `unitPrice` alanı **kuruş** cinsindendir (lira girişinden `liraToKurus` ile çevrilir), boşsa `null`.

- [ ] **Step 1: Dosyayı oluştur (tam içerik)**

`src/components/app/manual-part-dialog.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Plus, Minus, Loader2 } from "lucide-react"
import { PartAttributeField } from "@/components/app/part-attribute-field"
import { liraToKurus } from "@/lib/money"

export type ManualPartDraft = {
  name: string
  brand: string | null
  category: string | null
  categoryId: number | null
  quantity: number
  unitPrice: number | null // kuruş
}

/**
 * "Oluştur & Düzenle" modalı: birleşik parça arama kutusundan açılır. Yazılan
 * metni ön-doldurur; marka/kategori/miktar/birim fiyatı odaklı bir formda
 * toplayıp onSubmit ile üst bileşene (addItem) verir. Manuel parça = source
 * "manual" (üst bileşen atar). PartAttributeField, üstteki PartAttrOptionsProvider
 * bağlamına (React portal bağlamı korunur) güvenir.
 */
export function ManualPartDialog({
  open,
  onOpenChange,
  initialName,
  vehicleTypeId,
  submitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  initialName: string
  vehicleTypeId: number | null
  submitting: boolean
  onSubmit: (d: ManualPartDraft) => void
}) {
  const [name, setName] = useState(initialName)
  const [brand, setBrand] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [priceDraft, setPriceDraft] = useState("")

  // Her açılışta formu ön-dolu ad ile temiz başlat.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(initialName)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrand(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategory(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategoryId(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuantity(1)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPriceDraft("")
  }, [open, initialName])

  function submit() {
    if (!name.trim() || submitting) return
    const lira = Number(priceDraft)
    const unitPrice = priceDraft && !Number.isNaN(lira) && lira >= 0 ? liraToKurus(lira) : null
    onSubmit({ name: name.trim(), brand, category, categoryId, quantity, unitPrice })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Parça</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">Parça adı</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Parça adı (ör. ön fren balatası)"
              className="text-sm"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Marka</span>
              <PartAttributeField
                kind="brand"
                vehicleTypeId={vehicleTypeId}
                value={brand ?? ""}
                onSelect={(_id, n) => setBrand(n)}
                onCommitFreeText={(v) => setBrand(v || null)}
                onClear={() => setBrand(null)}
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Kategori</span>
              <PartAttributeField
                kind="category"
                vehicleTypeId={vehicleTypeId}
                value={category ?? ""}
                onSelect={(id, n) => { setCategory(n); setCategoryId(id) }}
                onCommitFreeText={(v) => { setCategory(v || null); setCategoryId(null) }}
                onClear={() => { setCategory(null); setCategoryId(null) }}
              />
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Miktar</span>
              <div className="inline-flex h-9 items-center rounded-lg border border-input bg-background">
                <Button type="button" variant="ghost" size="icon-xs" className="rounded-r-none"
                  aria-label="Azalt" disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Minus />
                </Button>
                <span className="min-w-6 px-1 text-center text-xs font-medium tabular-nums">{quantity}</span>
                <Button type="button" variant="ghost" size="icon-xs" className="rounded-l-none"
                  aria-label="Arttır" onClick={() => setQuantity((q) => q + 1)}>
                  <Plus />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Birim Fiyat</span>
              <InputGroup className="h-9 w-32">
                <InputGroupAddon className="text-muted-foreground">₺</InputGroupAddon>
                <InputGroupInput
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Fiyat"
                  className="text-sm tabular-nums"
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Vazgeç
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS (yeni dosyada tip hatası yok). Not: `PartAttributeField`'in tüm zorunlu prop'ları (`kind`, `vehicleTypeId`, `value`, `onSelect`, `onCommitFreeText`, `onClear`) verildi.

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: PASS. `set-state-in-effect` uyarıları eslint-disable ile bastırıldı.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/manual-part-dialog.tsx
git commit -m "feat(orders): 'Oluştur & Düzenle' manuel parça modalı"
```

---

## Task 2: `PartSearchInput`'a create aksiyonlarını ekle

**Files:**
- Modify: `src/components/app/part-search-input.tsx`

**Interfaces:**
- Produces (yeni opsiyonel prop'lar): `showCreate?: boolean`, `onCreate?: (name: string) => void`, `onCreateEdit?: (name: string) => void`. Bu prop'lar verilmezse davranış eskisiyle bire bir aynıdır (liste satırları etkilenmez).
- Consumes: mevcut `Autocomplete*`, `InputGroup*`, yeni lucide ikonları `Plus`, `PencilLine`, `Button`.

- [ ] **Step 1: İmportlara `Plus`, `PencilLine`, `Button` ekle**

`src/components/app/part-search-input.tsx` — mevcut lucide importunu değiştir:

```tsx
import { PackageSearch, Search, XIcon, Plus, PencilLine } from "lucide-react"
import { Button } from "@/components/ui/button"
```

- [ ] **Step 2: Yeni prop'ları imzaya ekle**

`onSearchClick`, `searchDisabled`, `searchTitle`'dan hemen sonra prop listesine ve tip bloğuna ekle:

Prop destructuring'e (fonksiyon parametreleri):
```tsx
  onSearchClick,
  searchDisabled,
  searchTitle,
  showCreate,
  onCreate,
  onCreateEdit,
```

Tip bloğuna (`searchTitle?: string`'den sonra):
```tsx
  /** Composer'da (bare DEĞİL): dropdown'da her zaman görünen "Oluştur/Oluştur & Düzenle" aksiyonları. */
  showCreate?: boolean
  onCreate?: (name: string) => void
  onCreateEdit?: (name: string) => void
```

- [ ] **Step 3: Ortak `CreateActions` yardımcı bileşenini component gövdesine ekle**

`const canClear = ...` satırından hemen önce (component gövdesinin başında), closure içinde tanımla:

```tsx
  // Composer'da dropdown/altında her zaman görünen Odoo-tarzı create aksiyonları.
  // bare (liste satırı) kullanımında showCreate geçilmez → hiç render edilmez.
  function CreateActions({ text }: { text: string }) {
    const t = text.trim()
    if (!showCreate || !t) return null
    return (
      <div className="flex flex-col gap-0.5 border-t border-border p-1">
        {onCreate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 justify-start gap-2 font-normal"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCreate(t)}
          >
            <Plus className="size-4 text-primary" />
            <span>Oluştur <span className="font-semibold">“{t}”</span></span>
          </Button>
        )}
        {onCreateEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 justify-start gap-2 font-normal text-muted-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCreateEdit(t)}
          >
            <PencilLine className="size-4" />
            Oluştur &amp; Düzenle…
          </Button>
        )}
      </div>
    )
  }
```

- [ ] **Step 4: Katalogsuz dalda (`vehicleTypeId == null`) create aksiyonlarını göster + blur-create'i engelle**

Mevcut `if (vehicleTypeId == null) { return ( <InputGroup>...</InputGroup> ) }` bloğunu şununla değiştir:

```tsx
  // Araç kataloğa bağlı değil → arama yok, düz metin girişi + (composer'da) create aksiyonları.
  if (vehicleTypeId == null) {
    return (
      <div className="space-y-1.5">
        <InputGroup>
          {skuChip}
          <InputGroupInput
            value={value}
            onChange={(e) => onNameChange(e.target.value)}
            // Composer (showCreate): blur ekleme YAPMAZ (odak kaybında istenmeyen ekleme
            // olmasın). Liste satırı (bare): blur'da serbest metni kalıcılaştırır.
            onBlur={showCreate ? undefined : onCommit}
            onKeyDown={
              showCreate
                ? (e) => {
                    if (e.key === "Enter" && value.trim()) {
                      e.preventDefault()
                      onCreate?.(value)
                    }
                  }
                : undefined
            }
            placeholder={placeholder}
            disabled={disabled}
            title={value || undefined}
            className="text-sm"
          />
          {trailing}
        </InputGroup>
        <CreateActions text={value} />
      </div>
    )
  }
```

- [ ] **Step 5: Katalog (linked) dalında dropdown açılış eşiğini gevşet + create aksiyonlarını footer'a ekle**

Linked dönüşte, `AutocompleteContent`'i saran koşulu ve içeriğini güncelle. Mevcut:

```tsx
      {(query.trim().length >= 2 || supplierId != null || categoryId != null) && (
      <AutocompleteContent>
        <AutocompleteEmpty className="flex-col gap-1.5">
          ...
        </AutocompleteEmpty>
        <AutocompleteList>
          ...
        </AutocompleteList>
      </AutocompleteContent>
      )}
```

Şununla değiştir (koşula `showCreate && query.trim().length >= 1` eklenir; `</AutocompleteList>`'ten sonra `<CreateActions>` render edilir):

```tsx
      {((showCreate ? query.trim().length >= 1 : query.trim().length >= 2) ||
        supplierId != null ||
        categoryId != null) && (
        <AutocompleteContent>
          <AutocompleteEmpty className="flex-col gap-1.5">
            <span>Eşleşen parça yok</span>
            {onSearchClick && !searchDisabled && (
              <InputGroupButton
                size="sm"
                variant="outline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onSearchClick}
              >
                <Search />
                Katalogdan getir
              </InputGroupButton>
            )}
          </AutocompleteEmpty>
          <AutocompleteList>
            {(a: ArticleSearchResult) => (
              <AutocompleteItem
                key={a.tecdocArticleId}
                value={a}
                onClick={() => onSelectArticle(a)}
              >
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    loading="lazy"
                    className="size-8 shrink-0 rounded object-contain bg-white border border-border/60"
                  />
                ) : (
                  <span className="size-8 shrink-0 rounded bg-muted flex items-center justify-center">
                    <PackageSearch className="size-4 text-muted-foreground/50" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{a.productName}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    <span className="font-mono">{a.articleNo}</span>
                    {a.supplierName && <> · {a.supplierName}</>}
                    {a.categoryName && <> · {a.categoryName}</>}
                  </span>
                </span>
              </AutocompleteItem>
            )}
          </AutocompleteList>
          <CreateActions text={query} />
        </AutocompleteContent>
      )}
```

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: PASS. Yeni prop'lar opsiyonel; mevcut çağıranlar (liste satırları) etkilenmez.

- [ ] **Step 7: Lint**

Run: `bun run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/app/part-search-input.tsx
git commit -m "feat(orders): PartSearchInput'a Oluştur/Oluştur & Düzenle aksiyonları"
```

---

## Task 3: `PartsLaborGrid`'i birleşik composer'a geçir

**Files:**
- Modify: `src/components/app/parts-labor-grid.tsx`

**Interfaces:**
- Consumes: `PartSearchInput` (yeni `showCreate`/`onCreate`/`onCreateEdit` — Task 2), `ManualPartDialog` + `ManualPartDraft` (Task 1), mevcut `addItem`, `emptyDraft`, `TecdocPartPicker`, `PartFilter`, `Row`.
- Produces: yeni `UnifiedPartComposer` bileşeni (dosya-içi). Dışarıya API değişmez (`PartsLaborGrid` props aynı).

- [ ] **Step 1: `ManualPartDialog` importunu ekle**

`import { SupplierPriceDialog } from "@/components/app/supplier-price-dialog"` satırından sonra:

```tsx
import { ManualPartDialog, type ManualPartDraft } from "@/components/app/manual-part-dialog"
```

- [ ] **Step 2: Sekme bloğunu 3→2 sekmeye indir (`Tabs` render'ı)**

`parts-labor-grid.tsx` içindeki `{!locked && ( <Tabs ...> ... </Tabs> )}` bloğunun tamamını şununla değiştir:

```tsx
      {!locked && (
        <Tabs defaultValue="parca">
          <TabsList variant="line" className="w-full flex-nowrap gap-1 border-b border-border pb-0 -mb-px sm:gap-2">
            <TabsTrigger value="parca" className="px-3 py-2 shrink-0">
              <PackagePlus className="size-4" /> Parça
            </TabsTrigger>
            <TabsTrigger value="iscilik" className="px-3 py-2 shrink-0">
              <Wrench className="size-4" /> İşçilik
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parca" className="pt-4">
            <ComposerCard>
              <UnifiedPartComposer vehicle={vehicle} onAdd={addItem} disabled={loading} />
            </ComposerCard>
          </TabsContent>
          <TabsContent value="iscilik" className="pt-4">
            <ComposerCard><LaborComposer onAdd={addItem} disabled={loading} /></ComposerCard>
          </TabsContent>
        </Tabs>
      )}
```

> Not: `linked` değişkeni artık sekme `defaultValue`'sunda kullanılmıyor; `PartsLaborGrid` gövdesinde başka kullanımı yoksa (`const linked = ...`) ESLint "unused" verirse o satırı sil. `EmptyItemsHint` `linked`'i prop olarak alıyor (Step 6), oradaki kullanım kalır → büyük olasılıkla silmeye gerek yok; typecheck/lint çıktısına göre karar ver.

- [ ] **Step 3: `CatalogComposer` + `CatalogComposerBody` + `ManualComposer` + `ManualComposerBody` fonksiyonlarını sil**

Bu dört fonksiyonun (yaklaşık `// ── Katalog composer:` yorumundan `ManualComposerBody`'nin kapanış `}`'ine kadar olan blok) tamamını kaldır. `LaborComposer`/`LaborComposerBody`/`LaborAutocompleteField`/`LaborModeToggle` KALIR.

- [ ] **Step 4: `UnifiedPartComposer`'ı ekle (silinen composer'ların yerine)**

Silinen bloğun yerine şu bileşeni ekle:

```tsx
// ── Birleşik parça composer: saf Odoo-tarzı arama kutusu. Katalog eşleşmesi
// seçme / Oluştur "X" / Oluştur & Düzenle — hepsi doğrudan addItem çağırır.
// Satır anında listeye düşer; miktar/fiyat/marka/kategori satır-içinde düzenlenir.
// Başarılı eklemeden sonra kutu temizlenir + odak korunur (kontrollü value="").
function UnifiedPartComposer({ vehicle, onAdd, disabled }: {
  vehicle?: PickerVehicle; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean
}) {
  const [name, setName] = useState("")
  const [filter, setFilter] = useState<PartFilter>({})
  const [tecdocOpen, setTecdocOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const linked = vehicle?.catalogVehicleTypeId != null

  // Tek ekleme yolu: emptyDraft üzerine partial'ı bindir → addItem. Başarıda kutuyu sıfırla.
  async function add(partial: Partial<Row> & { source: "catalog" | "manual" }): Promise<boolean> {
    if (submitting || !partial.name?.trim()) return false
    setSubmitting(true)
    const ok = await onAdd({ ...emptyDraft("part", partial.source), ...partial, name: partial.name.trim() })
    setSubmitting(false)
    if (ok) { setName(""); setFilter({}) }
    return ok
  }

  return (
    <div className="space-y-3">
      {!linked && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Araç katalogla eşleşmediği için katalog araması sınırlı — parçayı{" "}
          <span className="font-semibold text-foreground">Oluştur</span> ile elle ekleyebilirsiniz.
        </p>
      )}

      <PartSearchInput
        value={name}
        sku={null}
        vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
        supplierId={filter.supplierId ?? null}
        categoryId={filter.categoryId ?? null}
        disabled={disabled || submitting}
        placeholder="Parça ara veya ekle…"
        onNameChange={setName}
        onSelectArticle={(a) =>
          void add({
            source: "catalog",
            name: a.productName,
            sku: a.articleNo,
            brand: a.supplierName || null,
            category: a.categoryName || null,
            categoryId: a.categoryId || null,
          })
        }
        onCommit={() => { if (name.trim()) void add({ source: "manual", name }) }}
        onClear={() => { setName(""); setFilter({}) }}
        showClear={!!name}
        onSearchClick={linked ? () => setTecdocOpen(true) : undefined}
        searchDisabled={!linked}
        searchTitle={linked ? "TecDoc kataloğundan seç" : "Araç TecDoc'ta eşleşmedi"}
        showCreate
        onCreate={(text) => void add({ source: "manual", name: text })}
        onCreateEdit={(text) => { setName(text); setDialogOpen(true) }}
      />

      {/* Tam TecDoc katalog picker (🔍) — yalnız araç kataloğa bağlıysa. */}
      {linked && (
        <TecdocPartPicker
          vehicle={vehicle}
          hideTrigger
          open={tecdocOpen}
          onOpenChange={setTecdocOpen}
          onSelect={(sel) => {
            void add({
              source: "catalog",
              name: sel.name,
              sku: sel.articleNo,
              brand: sel.supplierName,
              category: sel.categoryName || null,
              categoryId: sel.categoryId || null,
            })
            setTecdocOpen(false)
          }}
        />
      )}

      {/* Oluştur & Düzenle modalı. */}
      <ManualPartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={name}
        vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
        submitting={submitting}
        onSubmit={(d: ManualPartDraft) => {
          void add({
            source: "manual",
            name: d.name,
            brand: d.brand,
            category: d.category,
            categoryId: d.categoryId,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
          }).then((ok) => { if (ok) setDialogOpen(false) })
        }}
      />
    </div>
  )
}
```

> Doğrulama notu: `TecdocPartPicker`'ın `onSelect` argümanı (`sel`) `name`, `articleNo`, `supplierName`, `categoryName`, `categoryId` alanlarını içerir (mevcut `RowTecdocPicker` kullanımıyla birebir aynı). `emptyDraft("part", source)` `quantity: 1`, `unitPrice: null` verir; catalog/manuel `add` çağrıları bunları gerektiğinde ezer.

- [ ] **Step 5: `EmptyItemsHint` yönlendirme metnini güncelle**

`EmptyItemsHint` içindeki sekme-adı yönlendirmesini tek "Parça" sekmesine göre sadeleştir. Mevcut:

```tsx
      {!locked && (
        <p className="text-xs text-muted-foreground">
          Yukarıdan <span className="font-semibold text-foreground">{linked ? "Araca Uygun Parça" : "Elle Parça Yaz"}</span>{" "}
          sekmesiyle arayarak başlayın
        </p>
      )}
```

Şununla değiştir:

```tsx
      {!locked && (
        <p className="text-xs text-muted-foreground">
          Yukarıdaki <span className="font-semibold text-foreground">Parça</span> kutusundan arayarak veya
          {" "}<span className="font-semibold text-foreground">Oluştur</span> ile ekleyerek başlayın
        </p>
      )}
```

> Not: `EmptyItemsHint`'in `linked` prop'u artık gövdede kullanılmıyorsa, prop'u ve iki çağrı yerindeki `linked={linked}`'i kaldır; VEYA basitlik için prop'u imzada tutup kullanmayı bırakma (lint "unused prop" vermez ama okunurluk için kaldırmak tercih edilir). Typecheck/lint çıktısına göre en temiz olanı uygula.

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: PASS. Silinen composer'lara referans kalmadığından ve `UnifiedPartComposer` tüm `addItem` alanlarını doğru tiplerle verdiğinden hata olmamalı.

- [ ] **Step 7: Lint**

Run: `bun run lint`
Expected: PASS. Kullanılmayan import (`Separator` hâlâ kullanılıyor; `PencilLine` grid'de `SourceBadge`'de kullanılıyor) veya değişken uyarısı çıkarsa temizle (özellikle `linked` — Step 2/5 notları).

- [ ] **Step 8: Build**

Run: `bun run build`
Expected: PASS (Next production derlemesi başarılı).

- [ ] **Step 9: Commit**

```bash
git add src/components/app/parts-labor-grid.tsx
git commit -m "feat(orders): parça ekleme tek Odoo-tarzı arama menüsüne birleştirildi"
```

- [ ] **Step 10: Manuel QA (spec §Manuel QA — çalışan uygulamada)**

`bun run dev` ile bir iş emri detayında doğrula:
1. Kataloğa bağlı araçta ara → eşleşme seç → satır düşer, fiyatı satırda gir.
2. Eşleşmeyen metin → `Oluştur "X"` → manuel satır düşer.
3. `Oluştur & Düzenle` → modalda marka/kategori/miktar/fiyat → Ekle.
4. Kataloğa bağlı OLMAYAN araç: yalnız Oluştur seçenekleri çıkıyor.
5. Ekleme sonrası kutu temizleniyor + odakta kalıyor.
6. Sağdaki 🔍 TecDoc picker modalı çalışıyor.
7. İşçilik sekmesi (iç/dış) bozulmadı.
8. Kilitli emirde composer + create aksiyonları gizli.
9. Mobil: modal + arama kutusu + satır kartları dokunma-dostu.
10. Satır-içi düzenleme, otosave flash, fiyat karşılaştırma, dış-alım rozeti bozulmadı.

---

## Self-Review

**Spec coverage:**
- Genel yapı (3→2 sekme, saf arama kutusu, üst kart kalkar) → Task 3 Step 2/3/4. ✓
- Katalog seçme / Oluştur / Oluştur & Düzenle davranışları → Task 3 Step 4 (`add`), Task 2 (footer), Task 1 (modal). ✓
- Dropdown'da her zaman görünen create aksiyonları + katalogsuz dal → Task 2 Step 4/5. ✓
- 🔍 TecDoc picker korunur → Task 3 Step 4. ✓
- Reset + odak koru → Task 3 Step 4 (kontrollü `value=""`). ✓
- İşçilik sekmesi aynen → Task 3 Step 2 (`LaborComposer` korunur). ✓
- Şema/DB/sunucu değişikliği yok → Global Constraints + `addItem` yeniden kullanımı. ✓
- `EmptyItemsHint` metni → Task 3 Step 5. ✓

**Placeholder scan:** TBD/TODO yok; tüm kod blokları tam. "Typecheck/lint çıktısına göre karar ver" notları gerçek bir uygulama-anı kararıdır (kullanılmayan `linked`), placeholder değil.

**Type consistency:** `add(partial: Partial<Row> & { source })` her yerde `Row` alanlarını kullanır; `ManualPartDraft.unitPrice` kuruş (Task 1) → Task 3'te doğrudan `unitPrice`'a geçer; `emptyDraft(type, source)` imzası (mevcut) korunur; `PartSearchInput` yeni prop adları (`showCreate`/`onCreate`/`onCreateEdit`) Task 2 ve Task 3'te birebir eşleşir.
