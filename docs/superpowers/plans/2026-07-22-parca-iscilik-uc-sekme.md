# Parça & İşçilik 3-Sekme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş emri "Parça & İşçilik" ekleme alanını 2-sekme+alt-toggle yapısından 3 üst sekmeye (Katalogdan Parça / Manuel Parça / İşçilik) dönüştürmek.

**Architecture:** Tek dosyada (`src/components/app/parts-labor-grid.tsx`) UI restructure. `TabsList`'e üçüncü sekme; yeni `LaborComposer` (İç/Dış segment + serbest-metin Autocomplete); Katalog ve Manuel composer'larından işçilik dalları çıkarılır. Migration yok, server/veri modeli değişmiyor.

**Tech Stack:** Next.js (client component), React, shadcn/Base UI (`ui/tabs`, `ui/autocomplete`, `ui/input`, `ui/button`), Tailwind, TypeScript strict, bun.

## Global Constraints

- Tek dosya kapsamı: yalnız `src/components/app/parts-labor-grid.tsx` değişir. Server/actions/schema/mock dosyalarına DOKUNULMAZ.
- Migration YOK — `ServiceOrderItem.type` zaten `part|labor|external_labor`, `source` zaten `catalog|manual`.
- Para birimi her zaman KURUŞ (Int). `unitPrice`/`defaultPriceKurus` kuruş.
- Mobile-first: <md kart, md+ tablo; yatay taşma yok.
- TypeScript strict, `any` yok.
- ShadcnUI/Base UI bileşenleri; custom UI yok. Combobox serbest-metin DEĞİL → işçilik ad alanı `ui/autocomplete` ile.
- Composer'lar `!locked` guard'ının içinde kalır; kilitli emirde gizli.
- `key={mode-nonce}` remount deseni korunur (her ekleme/mod değişiminde form sıfırlanır).
- Verification: `bun run typecheck` + `bun run lint` temiz olmalı; component unit-test harness'ı yok → davranış Playwright manuel QA ile doğrulanır.

---

### Task 1: İzole worktree + spec commit

Paralel oturum riskine karşı (memory: `isolate-parallel-work-in-worktree`) işi ayrı worktree'de yap.

**Files:**
- Move (git): `docs/superpowers/specs/2026-07-22-parca-iscilik-uc-sekme-design.md`, `docs/superpowers/plans/2026-07-22-parca-iscilik-uc-sekme.md` (worktree'ye taşınır)

**Interfaces:**
- Consumes: yok
- Produces: `feat/parca-iscilik-uc-sekme` dalında izole worktree

- [ ] **Step 1: Worktree oluştur**

Ana ağaç `dev`'de. `dev`'den yeni dal + worktree:

```bash
cd /Users/void/www/bakimx
git worktree add -b feat/parca-iscilik-uc-sekme ../bakimx-uc-sekme dev
```

Expected: `Preparing worktree ... HEAD is now at ...`

- [ ] **Step 2: Spec + plan dosyalarını worktree'de doğrula**

Bu dosyalar `dev` üzerinde untracked'sa worktree'ye kopyalanmış olmayabilir. Kontrol:

```bash
ls ../bakimx-uc-sekme/docs/superpowers/specs/2026-07-22-parca-iscilik-uc-sekme-design.md \
   ../bakimx-uc-sekme/docs/superpowers/plans/2026-07-22-parca-iscilik-uc-sekme.md
```

Yoksa ana ağaçtan kopyala:

```bash
mkdir -p ../bakimx-uc-sekme/docs/superpowers/specs ../bakimx-uc-sekme/docs/superpowers/plans
cp docs/superpowers/specs/2026-07-22-parca-iscilik-uc-sekme-design.md ../bakimx-uc-sekme/docs/superpowers/specs/
cp docs/superpowers/plans/2026-07-22-parca-iscilik-uc-sekme.md ../bakimx-uc-sekme/docs/superpowers/plans/
```

- [ ] **Step 3: Spec + plan'ı commit et**

```bash
cd ../bakimx-uc-sekme
git add docs/superpowers/specs/2026-07-22-parca-iscilik-uc-sekme-design.md docs/superpowers/plans/2026-07-22-parca-iscilik-uc-sekme.md
git commit -m "docs(orders): parça/işçilik 3-sekme spec + plan"
```

Bundan sonraki TÜM adımlar `../bakimx-uc-sekme` içinde yapılır.

---

### Task 2: İşçilik sekmesi (İç/Dış toggle + serbest-metin autocomplete)

Üçüncü sekmeyi additive olarak ekle — eski işçilik giriş noktaları (Katalog toggle, Manuel Tür select) HENÜZ kaldırılmaz, böylece hiçbir aşamada işçilik girişi kaybolmaz.

**Files:**
- Modify: `src/components/app/parts-labor-grid.tsx`

**Interfaces:**
- Consumes: `searchLaborCatalog`, `getMockLaborCatalog`, `LaborCatalogEntry` (`@/lib/labor/mock-labor-catalog`); `emptyDraft`, `Row`, `OnCell`, `Field`, `ComposerFooter`, `useRowEditor`, `cn`, `formatTRY` (aynı dosya); `Autocomplete*` (`@/components/ui/autocomplete`), `Input`, `Button`.
- Produces: `LaborModeToggle`, `LaborAutocompleteField`, `LaborComposer`, `LaborComposerBody`; `iscilik` `TabsContent`.

- [ ] **Step 1: Importları ekle**

Üstteki import bloğunda `getMockLaborCatalog`'a ek olarak `searchLaborCatalog`'ı al ve Autocomplete primitive'ini ekle. Mevcut satır 29:

```ts
import { getMockLaborCatalog, type LaborCatalogEntry } from "@/lib/labor/mock-labor-catalog"
```

şununla değiştir:

```ts
import { getMockLaborCatalog, searchLaborCatalog, type LaborCatalogEntry } from "@/lib/labor/mock-labor-catalog"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
```

`lucide-react` importuna (satır 27) `ExternalLink` ekle (varsa atla):

```ts
import { Plus, Minus, Trash2, Loader2, Pencil, PackagePlus, PencilLine, Tags, PackageCheck, Wrench, ExternalLink } from "lucide-react"
```

- [ ] **Step 2: `LaborModeToggle` bileşenini ekle**

`CatalogModeToggle` fonksiyonunun (satır ~374-398) hemen ALTINA ekle. `CatalogModeToggle` deseninin birebir işçilik ikizidir:

```tsx
// İki-düğmeli segment: İşçilik composer'ında İç / Dış işçilik modu.
function LaborModeToggle({ mode, onChange, disabled }: {
  mode: "labor" | "external_labor"; onChange: (m: "labor" | "external_labor") => void; disabled: boolean
}) {
  const opts: Array<{ value: "labor" | "external_labor"; label: string; Icon: typeof Wrench }> = [
    { value: "labor", label: "İç İşçilik", Icon: Wrench },
    { value: "external_labor", label: "Dış İşçilik", Icon: ExternalLink },
  ]
  return (
    <div className="inline-flex rounded-lg border border-input bg-muted/40 p-0.5">
      {opts.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mode === value ? "default" : "ghost"}
          disabled={disabled}
          onClick={() => onChange(value)}
          className={cn("gap-1.5", mode !== value && "text-muted-foreground")}
        >
          <Icon className="size-3.5" /> {label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: `LaborAutocompleteField` bileşenini ekle**

`LaborModeToggle`'ın hemen altına ekle. Serbest-metin + mock öneri; `PartSearchInput`'un Autocomplete desenini izler (`filter={null}`, `autoHighlight`, `openOnInputClick`). Öneri seçimi ad+fiyatı doldurur; serbest metin sadece adı yazar (fiyat elle). Kaynak (`source`) burada DEĞİL, ekleme anında (Step 5) belirlenir.

```tsx
// İç işçilik ad alanı: serbest-metin Autocomplete + mock katalog önerileri.
// Yazdıkça searchLaborCatalog önerir; öneri seçilince ad+önerilen fiyat dolar;
// serbest metin de yazılabilir (kendi işçilik kalemi — fiyat elle girilir).
function LaborAutocompleteField({ draft, onCell, disabled }: {
  draft: Row; onCell: OnCell; disabled: boolean
}) {
  const items = useMemo(() => searchLaborCatalog(draft.name), [draft.name])
  return (
    <Autocomplete
      items={items}
      value={draft.name}
      filter={null}
      autoHighlight
      openOnInputClick
      itemToStringValue={(e: LaborCatalogEntry) => e.name}
      onValueChange={(v: string) => onCell(draft, { name: v })}
    >
      <AutocompleteInput
        render={
          <Input
            placeholder="İşçilik ara veya kendi kalemini yaz"
            disabled={disabled}
            title={draft.name || undefined}
            className="text-sm"
          />
        }
      />
      <AutocompleteContent>
        <AutocompleteEmpty>Tanımlı işçilik yok — kendi kaleminizi yazabilirsiniz</AutocompleteEmpty>
        <AutocompleteList>
          {(e: LaborCatalogEntry) => (
            <AutocompleteItem
              key={e.id}
              value={e}
              onClick={() => onCell(draft, { name: e.name, unitPrice: e.defaultPriceKurus })}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {e.category} · {formatTRY(e.defaultPriceKurus)}
                </span>
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  )
}
```

- [ ] **Step 4: `LaborComposer` (kabuk) bileşenini ekle**

`LaborAutocompleteField`'in altına ekle. `CatalogComposer`/`ManualComposer` remount desenini izler.

```tsx
// ── İşçilik composer: İç (mock öneri + serbest) / Dış (serbest) işçilik.
// mode+nonce anahtarıyla remount → mod değişince ve her eklemede yerel state
// (draft, arama kutusu) temiz sıfırlanır.
function LaborComposer({ onAdd, disabled }: {
  onAdd: (draft: Row) => Promise<boolean>; disabled: boolean
}) {
  const [nonce, setNonce] = useState(0)
  const [mode, setMode] = useState<"labor" | "external_labor">("labor")
  return (
    <div className="space-y-3">
      <LaborModeToggle mode={mode} onChange={setMode} disabled={disabled} />
      <LaborComposerBody
        key={`${mode}-${nonce}`}
        mode={mode}
        onAdd={onAdd}
        disabled={disabled}
        onAdded={() => setNonce((n) => n + 1)}
      />
    </div>
  )
}
```

- [ ] **Step 5: `LaborComposerBody` bileşenini ekle**

`LaborComposer`'ın altına ekle. İç modda `LaborAutocompleteField`, Dış modda düz `Input`. Kaynak ekleme anında ad-eşleşmesiyle belirlenir (race'siz): İç işçilikte ad tanımlı (mock) bir kaleme birebir eşleşiyorsa `source="catalog"`, aksi halde `source="manual"`; Dış her zaman `manual`.

```tsx
function LaborComposerBody({ mode, onAdd, disabled, onAdded }: {
  mode: "labor" | "external_labor"; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; onAdded: () => void
}) {
  const [draft, setDraft] = useState<Row>(() => emptyDraft(mode, "manual"))
  const [submitting, setSubmitting] = useState(false)
  const onCell: OnCell = (_row, patch) => setDraft((d) => ({ ...d, ...patch }))
  // İşçilikte araç bağı yok; useRowEditor yalnız fiyat/toplam mantığı için.
  const ed = useRowEditor(draft, undefined, false, onCell)
  const isExternal = mode === "external_labor"

  async function submit() {
    if (!draft.name.trim() || submitting) return
    setSubmitting(true)
    // Tanımlı (mock) işçilik adına birebir eşleşme → catalog rozeti; değilse manuel.
    const isDefined = mode === "labor" && getMockLaborCatalog().some((e) => e.name === draft.name.trim())
    const ok = await onAdd({ ...draft, source: isDefined ? "catalog" : "manual" })
    if (ok) onAdded()
    else setSubmitting(false)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={isExternal ? "Dış İşçilik" : "İşçilik"} className="sm:col-span-2 lg:col-span-4">
          {isExternal ? (
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Dış işçilik adı (ör. dış atölye kaporta)"
              title={draft.name || undefined}
              disabled={disabled}
              className="text-sm"
            />
          ) : (
            <LaborAutocompleteField draft={draft} onCell={onCell} disabled={disabled} />
          )}
        </Field>
      </div>
      <ComposerFooter draft={draft} ed={ed} onCell={onCell} onSubmit={submit} submitting={submitting} disabled={disabled} />
    </div>
  )
}
```

- [ ] **Step 6: Üçüncü sekmeyi ekle**

`TabsList` (satır ~199-206) içine üçüncü `TabsTrigger` ekle. Mevcut:

```tsx
            <TabsTrigger value="manuel" className="px-3 py-2 shrink-0">
              <PencilLine className="size-4" /> Manuel Parça
            </TabsTrigger>
          </TabsList>
```

şununla değiştir:

```tsx
            <TabsTrigger value="manuel" className="px-3 py-2 shrink-0">
              <PencilLine className="size-4" /> Manuel Parça
            </TabsTrigger>
            <TabsTrigger value="iscilik" className="px-3 py-2 shrink-0">
              <Wrench className="size-4" /> İşçilik
            </TabsTrigger>
          </TabsList>
```

`TabsContent value="manuel"` bloğunun (satır ~211-213) hemen ALTINA ekle:

```tsx
          <TabsContent value="iscilik" className="pt-3">
            <LaborComposer onAdd={addItem} disabled={loading} />
          </TabsContent>
```

- [ ] **Step 7: Typecheck + lint**

```bash
cd /Users/void/www/bakimx-uc-sekme && bun run typecheck && bun run lint
```

Expected: iki komut da hatasız (exit 0). Hata varsa (ör. `AutocompleteInput` render prop tipi, `Input` import'u), düzelt.

- [ ] **Step 8: Manuel QA (Playwright)**

Dev sunucusu çalışıyor kabul (yoksa `bun run dev`). Bir iş emri detayına git → Parça & İşçilik sekmesi. Doğrula:
- Üç sekme görünür: Katalogdan Parça / Manuel Parça / İşçilik.
- İşçilik sekmesi: "İç İşçilik / Dış İşçilik" segment.
- İç: "yağ" yaz → "Motor yağı ve filtre değişimi" önerisi düşer → seç → ad + ₺350 dolar → Ekle → listeye "İşçilik" türünde, katalog rozetiyle düşer.
- İç: "özel kaporta" yaz (öneri yok) → fiyat gir → Ekle → "İşçilik" türünde, manuel rozetle düşer.
- Dış: "dış atölye boya" + fiyat → Ekle → "Dış İşçilik" türünde düşer.
- Fiyatlandırma paneli: İşçilik Toplamı ve Dış İşçilik Toplamı doğru ayrışır.

- [ ] **Step 9: Commit**

```bash
cd /Users/void/www/bakimx-uc-sekme
git add src/components/app/parts-labor-grid.tsx
git commit -m "feat(orders): İşçilik sekmesi (iç/dış toggle + serbest-metin autocomplete)"
```

---

### Task 3: Katalog sekmesini sadeleştir (parça-only)

Artık işçilik kendi sekmesinde → Katalog composer'ından işçilik dalını ve `CatalogModeToggle`'ı kaldır.

**Files:**
- Modify: `src/components/app/parts-labor-grid.tsx`

**Interfaces:**
- Consumes: Task 2 çıktısı (İşçilik sekmesi çalışıyor).
- Produces: `CatalogComposer` (parça-only), `CatalogModeToggle` silinir.

- [ ] **Step 1: `CatalogModeToggle` bileşenini sil**

Satır ~373-398 arasındaki `CatalogModeToggle` fonksiyonunu (yorum satırı dahil) tamamen sil.

- [ ] **Step 2: `CatalogComposer`'ı parça-only yap**

Mevcut `CatalogComposer` (satır ~403-421):

```tsx
function CatalogComposer({ vehicle, onAdd, disabled }: {
  vehicle?: PickerVehicle; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean
}) {
  const [nonce, setNonce] = useState(0)
  const [mode, setMode] = useState<"part" | "labor">("part")
  return (
    <div className="space-y-3">
      <CatalogModeToggle mode={mode} onChange={setMode} disabled={disabled} />
      <CatalogComposerBody
        key={`${mode}-${nonce}`}
        mode={mode}
        vehicle={vehicle}
        onAdd={onAdd}
        disabled={disabled}
        onAdded={() => setNonce((n) => n + 1)}
      />
    </div>
  )
}
```

şununla değiştir:

```tsx
function CatalogComposer({ vehicle, onAdd, disabled }: {
  vehicle?: PickerVehicle; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean
}) {
  const [nonce, setNonce] = useState(0)
  return (
    <CatalogComposerBody
      key={nonce}
      vehicle={vehicle}
      onAdd={onAdd}
      disabled={disabled}
      onAdded={() => setNonce((n) => n + 1)}
    />
  )
}
```

- [ ] **Step 3: `CatalogComposerBody`'den işçilik dalını çıkar**

Mevcut `CatalogComposerBody` (satır ~423-471). İmza ve gövde işçilik (`mode`/`isLabor`) referanslarından arındırılır:

```tsx
function CatalogComposerBody({ vehicle, onAdd, disabled, onAdded }: {
  vehicle?: PickerVehicle; onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; onAdded: () => void
}) {
  const [draft, setDraft] = useState<Row>(() => emptyDraft("part", "catalog"))
  const [submitting, setSubmitting] = useState(false)
  const onCell: OnCell = (_row, patch) => setDraft((d) => ({ ...d, ...patch }))
  const ed = useRowEditor(draft, vehicle, false, onCell)

  async function submit() {
    if (!draft.name.trim() || submitting) return
    setSubmitting(true)
    const ok = await onAdd(draft)
    if (ok) onAdded() // remount → sıfırla
    else setSubmitting(false)
  }

  const clearPart = () => {
    setDraft((d) => ({ ...d, name: "", sku: null, brand: null, category: null, categoryId: null }))
    ed.setFilter({})
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Parça" className="sm:col-span-2 lg:col-span-2">
          <PartField row={draft} ed={ed} vehicle={vehicle} onCell={onCell} onClear={clearPart} />
          <RowTecdocPicker row={draft} ed={ed} vehicle={vehicle} onCell={onCell} />
        </Field>
        <Field label="Marka">
          <AttrCell kind="brand" row={draft} ed={ed} vehicle={vehicle} onCell={onCell} />
        </Field>
        <Field label="Kategori">
          <AttrCell kind="category" row={draft} ed={ed} vehicle={vehicle} onCell={onCell} />
        </Field>
      </div>
      <ComposerFooter draft={draft} ed={ed} onCell={onCell} onSubmit={submit} submitting={submitting} disabled={disabled} />
    </div>
  )
}
```

- [ ] **Step 4: Kullanılmayan `LaborCatalogField`'ı sil**

`LaborCatalogField` (Combobox tabanlı, satır ~328-371) artık hiçbir yerde çağrılmıyor → yorum satırıyla birlikte tamamen sil. (Bir sonraki adımda kullanılmayan Combobox importları da temizlenecek.)

- [ ] **Step 5: Kullanılmayan importları temizle**

`LaborCatalogField` silindiği için `Combobox*` importları (satır 11-18) artık kullanılmıyorsa sil. Doğrula:

```bash
cd /Users/void/www/bakimx-uc-sekme && grep -n "Combobox" src/components/app/parts-labor-grid.tsx
```

Sadece import satırları kalıyorsa (başka kullanım yoksa) satır 11-18'deki `Combobox` import bloğunu sil. `bun run lint` zaten `no-unused-vars` ile yakalar.

- [ ] **Step 6: Typecheck + lint**

```bash
cd /Users/void/www/bakimx-uc-sekme && bun run typecheck && bun run lint
```

Expected: hatasız. (Kalan işçilik referansı / kullanılmayan import → düzelt.)

- [ ] **Step 7: Manuel QA**

Katalog sekmesi: artık Parça/İşçilik toggle YOK; doğrudan parça alanları (Parça / Marka / Kategori). Araç TecDoc-eşleşmeli emirde parça ara/seç → eklenir, katalog rozeti. İşçilik sekmesi hâlâ çalışıyor (regresyon yok).

- [ ] **Step 8: Commit**

```bash
cd /Users/void/www/bakimx-uc-sekme
git add src/components/app/parts-labor-grid.tsx
git commit -m "refactor(orders): Katalog sekmesi parça-only (toggle + LaborCatalogField kaldırıldı)"
```

---

### Task 4: Manuel sekmesini sadeleştir (parça-only)

Manuel composer'dan Tür seçicisini (part/labor/external_labor) kaldır → daima parça.

**Files:**
- Modify: `src/components/app/parts-labor-grid.tsx`

**Interfaces:**
- Consumes: Task 2-3 çıktısı.
- Produces: `ManualComposerBody` (parça-only, Tür select'siz).

- [ ] **Step 1: `ManualComposerBody`'yi parça-only yap**

Mevcut `ManualComposerBody` (satır ~489-548). `Select`/`isPart`/`draft.type` dalları kaldırılır; daima parça:

```tsx
function ManualComposerBody({ onAdd, disabled, onAdded }: {
  onAdd: (draft: Row) => Promise<boolean>; disabled: boolean; onAdded: () => void
}) {
  const [draft, setDraft] = useState<Row>(() => emptyDraft("part", "manual"))
  const [submitting, setSubmitting] = useState(false)
  const onCell: OnCell = (_row, patch) => setDraft((d) => ({ ...d, ...patch }))
  // vehicle=undefined → katalog picker kapalı, saf serbest metin (marka/kategori
  // önerileri context'ten hâlâ gelir — araç bağlıysa yardımcı olur).
  const ed = useRowEditor(draft, undefined, false, onCell)

  async function submit() {
    if (!draft.name.trim() || submitting) return
    setSubmitting(true)
    const ok = await onAdd(draft)
    if (ok) onAdded()
    else setSubmitting(false)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Parça adı" className="sm:col-span-2">
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Parça adı"
            title={draft.name || undefined}
            className="text-sm"
          />
        </Field>
        <Field label="Marka">
          <AttrCell kind="brand" row={draft} ed={ed} onCell={onCell} />
        </Field>
        <Field label="Kategori">
          <AttrCell kind="category" row={draft} ed={ed} onCell={onCell} />
        </Field>
      </div>
      <ComposerFooter draft={draft} ed={ed} onCell={onCell} onSubmit={submit} submitting={submitting} disabled={disabled} />
    </div>
  )
}
```

- [ ] **Step 2: Kullanılmayan `Select` importlarını temizle**

`Select` artık kullanılmıyorsa doğrula ve sil:

```bash
cd /Users/void/www/bakimx-uc-sekme && grep -n "Select" src/components/app/parts-labor-grid.tsx
```

Sadece import satırı (7) kalıyorsa `Select*` importunu sil. `TYPE_LABELS` hâlâ liste kolonunda (`DesktopPartRow`/`MobilePartRow`) kullanılıyor — SİLME.

- [ ] **Step 3: Typecheck + lint**

```bash
cd /Users/void/www/bakimx-uc-sekme && bun run typecheck && bun run lint
```

Expected: hatasız.

- [ ] **Step 4: Manuel QA**

Manuel sekmesi: Tür seçici YOK; doğrudan Parça adı + Marka + Kategori + fiyat. Serbest parça ekle → listeye "Yedek Parça" türünde, manuel rozetle düşer.

- [ ] **Step 5: Commit**

```bash
cd /Users/void/www/bakimx-uc-sekme
git add src/components/app/parts-labor-grid.tsx
git commit -m "refactor(orders): Manuel sekmesi parça-only (Tür seçici kaldırıldı)"
```

---

### Task 5: Uçtan uca QA + build + dal tamamlama

**Files:**
- (yalnız doğrulama)

**Interfaces:**
- Consumes: Task 2-4.
- Produces: birleştirmeye hazır dal.

- [ ] **Step 1: Tam doğrulama**

```bash
cd /Users/void/www/bakimx-uc-sekme && bun run typecheck && bun run lint && bun run build
```

Expected: üçü de başarılı. (Build ağır; değişiklik anlamlı olduğu için çalıştırılır — CLAUDE.md "build if the change is significant".)

- [ ] **Step 2: Kapsamlı manuel QA (mobil + masaüstü)**

Spec §Manuel QA listesinin tamamı:
1. Katalog: TecDoc parça ara/seç → katalog rozeti.
2. Manuel: serbest parça + marka + kategori → manuel rozeti.
3. İşçilik/İç: mock öneri seç → ad+fiyat dolar.
4. İşçilik/İç: serbest kalem → manuel rozeti.
5. İşçilik/Dış: dış işçilik → "Dış İşçilik" türü.
6. Fiyatlandırma: İşçilik / Dış İşçilik toplamları ayrışıyor.
7. Mobil (<md): üç sekme + kartlar; yatay taşma yok.
8. Kilitli emir (delivered/cancelled): composer gizli, liste salt-görünür.

- [ ] **Step 3: superpowers:finishing-a-development-branch ile tamamla**

Dal birleştirme/PR kararı için `superpowers:finishing-a-development-branch` skill'ini kullan. Worktree `dev`'den açıldı; hedef `dev`.

---

## Self-Review

**Spec coverage:**
- 3 sekme → Task 2 Step 6. ✓
- Katalog parça-only → Task 3. ✓
- Manuel parça-only → Task 4. ✓
- İşçilik sekmesi (İç/Dış + tanımlı mock + serbest + dış) → Task 2. ✓
- Combobox→Autocomplete serbest-metin → Task 2 Step 3. ✓
- Kaynak (catalog/manual) davranışı → Task 2 Step 5 (ad-eşleşmesiyle, race'siz). ✓
- Değişmeyenler (liste, server, mock, quote) → hiçbir task dokunmuyor. ✓
- Mock katalog salt-okunur → korunuyor. ✓

**Placeholder scan:** TODO/TBD yok; tüm kod blokları tam. ✓

**Type consistency:**
- `LaborModeToggle` mode tipi `"labor" | "external_labor"` — `LaborComposer` state ve `LaborComposerBody` prop ile tutarlı. ✓
- `emptyDraft(type, source)` imzası korunuyor; `LaborComposerBody` `emptyDraft(mode, "manual")`, submit'te `source` override. ✓
- `useRowEditor(row, vehicle|undefined, locked, onCell)` imzası tüm çağrılarda tutarlı. ✓
- `OnCell`, `Row`, `Field`, `ComposerFooter` mevcut tiplerle uyumlu. ✓

**Not (uygulama sırasında doğrula):** `AutocompleteInput` `render={<Input .../>}` — `PartSearchInput` `InputGroupInput` kullanıyor; düz `ui/input` `Input` prop-forward ediyor mu Task 2 Step 7 typecheck'te görülür. Sorun çıkarsa `InputGroup`+`InputGroupInput` sarmalına geç.
