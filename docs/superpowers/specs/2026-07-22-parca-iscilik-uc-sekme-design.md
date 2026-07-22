# Parça & İşçilik composer'ı 3 sekmeye ayırma — Tasarım

**Tarih:** 2026-07-22
**Dosya kapsamı:** `src/components/app/parts-labor-grid.tsx` (tek dosya, UI-only)
**Migration:** Yok. Veri modeli değişmiyor.

## Amaç

İş emri detayındaki "Parça & İşçilik" ekleme alanını, mevcut **2 sekme + alt toggle**
yapısından **3 üst sekmeye** dönüştürmek:

- **Katalogdan Parça** — RapidAPI/TecDoc üzerinden aranan parçalar (mevcut davranış)
- **Manuel Parça** — kullanıcının kendi girdiği parça (mevcut davranış, sadeleşir)
- **İşçilik** *(yeni)* — hem tanımlı (mock) işçilikler hem de kullanıcının kendi/dış işçiliği

Mevcut yapı: `Tabs(Katalog|Manuel)` + Katalog içinde `CatalogModeToggle(Parça|İşçilik)`
segmenti. Manuel sekmesinde ise `Tür` `<Select>` (Yedek Parça/İşçilik/Dış İşçilik).

## Kararlar (kullanıcı onaylı)

1. **Net ayrım:** Katalog=parça, Manuel=parça, İşçilik=işçilik. Katalog ve Manuel
   içindeki eski parça/işçilik seçimi tamamen kalkar; tüm işçilik girişi İşçilik
   sekmesinde toplanır.
2. **İşçilik katalogu şimdilik mock kalır.** `src/lib/labor/mock-labor-catalog.ts`
   (24 statik kalem) kullanılmaya devam eder. Gerçek DB tablosu bu iş kapsamında
   YOK — ayrı bir çalışma olacak.
3. **İç/Dış işçilik ayrımı:** İşçilik sekmesinde `İç İşçilik / Dış İşçilik` 2-buton
   segment toggle. Ad alanı serbest yazılabilir; İç modda mock katalog önerileri düşer.

## Mevcut kod haritası (referans)

- Tek dosya: `parts-labor-grid.tsx` (~979 satır). Export: `PartsLaborGrid`.
- `type ItemType = "part" | "labor" | "external_labor"`, `TYPE_LABELS` üçünü kapsar.
- Tabs: satır 198-214. `CatalogModeToggle`: 374. `CatalogComposer`/`Body`: 403/423.
  `ManualComposer`/`Body`: 475/489. `LaborCatalogField` (Combobox): 330.
- CRUD: `addItem` (POST `/api/orders/items`), `persistUpdate` (PATCH), `removeRow`
  (DELETE). `FormData` ile `type`, `name`, `source`, `quantity`, `unitPrice`, ...
- Alt liste: `DesktopPartRow` (tablo) + `MobilePartRow` (kart). Her ikisi de üç tipi
  `TYPE_LABELS` ile gösterir; labor satırının adı için `PartField`'in `else` dalı
  düz `<Input>` render eder (satır-içi düzenleme zaten çalışıyor).
- Veri: `ServiceOrderItem` (Prisma) — `type OrderItemType(part|labor|external_labor)`,
  `source OrderItemSource(catalog|manual)`, `unitPrice/totalPrice` kuruş (Int).

## Teknik kısıt: Combobox serbest-metin değil

Mevcut `LaborCatalogField` `ui/combobox` (Base UI Combobox) kullanıyor. Bu bileşen
Enter'da input'u geri alır/temizler → **serbest metin girişine uygun değildir**
(memory: `base-ui-combobox-not-freeform`). Kullanıcının "kendi işçilik kalemini"
yazabilmesi için işçilik ad alanı **Autocomplete** (serbest-metin + öneri) ile
yeniden kurulacak. `PartSearchInput`'un kullandığı aynı `ui/autocomplete` primitive
esas alınacak; API uygulama sırasında doğrulanacak.

## Değişiklikler

### 1. TabsList — üçüncü sekme

`TabsList`'e üçüncü `TabsTrigger value="iscilik"` (`Wrench` ikonu, "İşçilik") eklenir.
`TabsContent value="iscilik"` → yeni `<LaborComposer onAdd={addItem} disabled={loading} />`.
Varsayılan sekme değişmez: `defaultValue={linked ? "katalog" : "manuel"}`.

### 2. Katalog sekmesi sadeleşir

- `CatalogModeToggle` bileşeni **silinir**.
- `CatalogComposer`: `mode` state ve toggle kaldırılır; gövde daima parça.
- `CatalogComposerBody`: `mode`/`isLabor` parametreleri ve `LaborCatalogField` dalı
  silinir; sadece parça alanları (`PartField` + `RowTecdocPicker` + Marka/Kategori
  `AttrCell`) kalır. `useRowEditor(draft, vehicle, false, onCell)`, `isPart=true`.

### 3. Manuel sekmesi sadeleşir

- `ManualComposerBody`'deki `Tür` `<Select>` (part/labor/external_labor) **silinir**.
- Draft daima `emptyDraft("part", "manual")`. `isPart` daima true → Marka/Kategori
  alanları her zaman görünür. Ad etiketi sabit "Parça adı".

### 4. Yeni İşçilik sekmesi

```
function LaborComposer({ onAdd, disabled })
  - nonce + mode: "labor" | "external_labor" state
  - <LaborModeToggle mode onChange disabled />   (İç İşçilik / Dış İşçilik)
  - <LaborComposerBody key={`${mode}-${nonce}`} mode onAdd disabled onAdded={bump} />
```

`LaborModeToggle` — `CatalogModeToggle` ile aynı görsel desen (2-buton segment):
- `labor` → "İç İşçilik" (`Wrench`)
- `external_labor` → "Dış İşçilik" (`Wrench` veya `ExternalLink` benzeri)

`LaborComposerBody({ mode, onAdd, disabled, onAdded })`:
- `draft = emptyDraft(mode, "manual")` (kaynak seçime göre güncellenir, aşağıda).
- `onCell = (_row, patch) => setDraft(d => ({...d, ...patch}))`.
- `ed = useRowEditor(draft, undefined, false, onCell)` — araç bağı yok.
- `isExternal = mode === "external_labor"`.
- Alan grid'i (tam genişlik):
  - `isExternal` → düz `<Input>` (serbest metin, "Dış işçilik adı").
  - değilse → `<LaborAutocompleteField draft onCell disabled />`.
- `<ComposerFooter draft ed onCell onSubmit={submit} submitting disabled />` (ortak).
- `submit`: `onAdd(draft)`; başarıda `onAdded()` (remount → sıfırla).

`LaborAutocompleteField({ draft, onCell, disabled })`:
- `ui/autocomplete` tabanlı serbest-metin alan.
- Yazılan metne göre `searchLaborCatalog(query)` (veya `getMockLaborCatalog()` filtre)
  önerileri; her öneri `name` + `category · formatTRY(defaultPriceKurus)` gösterir.
- Öneri seçilince: `onCell(draft, { name, unitPrice: defaultPriceKurus, source: "catalog" })`.
- Serbest metin commit: `onCell(draft, { name, source: "manual" })` (fiyat elle).
- Temizlenince: `onCell(draft, { name: "", unitPrice: null, source: "manual" })`.

### Kaynak (source) davranışı

- Tanımlı (mock) işçilik seçilir → `source="catalog"` → liste rozetinde
  "Katalogdan eklendi" (PackageCheck, primary).
- Serbest işçilik metni veya dış işçilik → `source="manual"` → "Manuel eklendi".
- `emptyDraft` labor sekmesinde varsayılan `"manual"`; katalog seçiminde `"catalog"`e
  çevrilir, ad temizlenince tekrar `"manual"`.

## Değişmeyen / dokunulmayan

- Alt birleşik liste (`DesktopPartRow`/`MobilePartRow`), `useRowEditor`, `PartField`,
  `AttrCell`, `QtyStepper`, `PriceField`, `TotalField`, `SourceBadge`.
- Server: `addItem`/`persistUpdate`/`removeRow`, `/api/orders/items`, `actions.ts`,
  `serviceOrderItemSchema` (üç tipi de kabul ediyor).
- Fiyatlandırma paneli (İşçilik Toplamı / Dış İşçilik Toplamı ayrı satırlar) — labor
  ve external_labor kalemleri zaten doğru toplanıyor.
- `src/lib/labor/mock-labor-catalog.ts` — sadece okunur, değişmez.
- `quote.ts` validation (parça/işçilik) — bu ekranı etkilemiyor.

## Risk alanları

- **Autocomplete serbest-metin davranışı:** Base UI Autocomplete API'sinin serbest
  commit + öneri seçimini birlikte desteklediği doğrulanmalı (PartSearchInput deseni).
- **Remount deseni:** `key={mode-nonce}` korunmalı ki her ekleme/mod değişiminde form
  temiz sıfırlansın (mevcut CatalogComposer davranışıyla tutarlı).
- **Kilitli emir:** Composer `!locked` guard'ının içinde; kilitli emirde üç sekme de
  gizli kalır (mevcut davranış korunur).

## Manuel QA

1. Katalog sekmesi: araç TecDoc-eşleşmeli emirde parça ara/seç → eklenir, rozet katalog.
2. Manuel sekmesi: serbest parça adı + marka + kategori + fiyat → eklenir, rozet manuel.
3. İşçilik sekmesi / İç: "yağ" yaz → mock öneri düşer → seç → ad+fiyat dolar → Ekle.
4. İşçilik sekmesi / İç: tanımsız "özel işçilik" yaz (serbest) + fiyat → Ekle → manuel rozet.
5. İşçilik sekmesi / Dış: dış işçilik adı + fiyat → Ekle → tür "Dış İşçilik".
6. Fiyatlandırma paneli: İşçilik Toplamı ve Dış İşçilik Toplamı doğru ayrışıyor.
7. Mobil (<md): üç sekme + kart listesi düzgün; yatay taşma yok.
8. Kilitli emir (delivered/cancelled): composer gizli, liste salt-görünür.
