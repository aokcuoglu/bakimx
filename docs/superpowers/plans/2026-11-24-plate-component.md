# Plate Bileşeni Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `PlateBadge` ve `DashPlate`'i, ülkesini saklanan plakadan tahmin eden tek bir `Plate` bileşeniyle değiştirmek.

**Architecture:** Saf bir tanıma fonksiyonu (`detectPlate`) sıkıştırılmış plakadan ülke + gösterim metni üretir. `Plate` sunucu bileşeni bunu çağırır, ülkeyi `data-plate-country` niteliğine yazar. Stil bir CSS module'de, ülke renkleri `globals.css` `:root` token'larında durur. Son adımda 23 çağrı yeri taşınır ve eski iki bileşen silinir.

**Tech Stack:** Next.js 16 / React 19 sunucu bileşeni, CSS Modules, `bun test` (`renderToStaticMarkup`).

**Spec:** `docs/superpowers/specs/2026-11-24-plate-component-design.md`

## Global Constraints

- Şema/migration yok.
- Tanıma sırası: TR → B → BG → UK → NL → D → yedek (TR bandı, metin olduğu gibi). İlk eşleşen kazanır.
- Ülke kodları ve adları: `TR` Türkiye, `D` Almanya, `NL` Hollanda, `B` Belçika, `BG` Bulgaristan, `UK` İngiltere.
- TR görünümü bugünkü `DashPlate` ile birebir: çerçeve, yazısız `--primary` bant.
- Yabancı bant ülke kodunu yazar (`aria-hidden`); ekran okuyucu için `sr-only` "<Ülke adı> plakası" metni.
- `.tsx` içinde sabit hex yok (`ui-contract.test.ts`); renkler `globals.css` `:root` token'ı ve kontrastı `theme-tokens.test.ts` ölçer.
- `"use client"` yok; `Plate` sunucu ve istemci bileşenlerinde çalışır.
- Dosya adları kebab-case (`plate.tsx`); testler `*.test.ts`.

## Review Focus

1. **Yanlış yazılmış TR plakası yabancı görünmemeli.** `12AB34`, `34ABC1234` gibi il koduyla başlayan ama standart dışı TR plakaları TR kalır (Task 1 testi).
2. **Başında sıfır olmayan TR plakası** (`6ABC123`): Belçika yalnız `1`/`2` ile başladığı için yedeğe düşer, B olmaz. `1ABC123` (Adana yazım hatası) B görünür; bu kabul edilen risktir (Task 1 testi ikisini de sabitler).
3. **Boşluklu/küçük harfli girdi** (seed'de `"34 ABC 123"` var): `detectPlate` önce `normalizePlate` ile sıkıştırır (Task 1 testi).
4. **Koyu tema:** NL/BE plakaları fiziksel renklerini korur (token yalnız `:root`'ta, `.dark` miras alır). TR koyu temada bugünkü gibi `--card`/`--foreground` ile çizilir (Task 2 QA adımı).
5. **Pano satır hizası:** `.rowStart:has(> .plate[data-size="lg"])` hashlenmiş sınıfa bağlı. Plaka taşınınca seçici `[data-plate-country]` niteliğine çevrilmezse "En uzun bekleyenler"de ad sütunu kayar (Task 3 QA adımı).

---

### Task 1: Ülke tanıma (`detectPlate`)

**Files:**
- Create: `src/lib/plate/country.ts`
- Test: `src/lib/plate/country.test.ts`

**Interfaces:**
- Consumes: `normalizePlate(input: string): string` from `@/lib/format`
- Produces:
  ```ts
  export type PlateCountry = "TR" | "D" | "NL" | "B" | "BG" | "UK"
  export type PlateInfo = { country: PlateCountry; text: string }
  export const PLATE_COUNTRY_NAMES: Record<PlateCountry, string>
  export function detectPlate(plate: string): PlateInfo
  ```

- [ ] **Step 1: Write the failing test**

`describe("detectPlate")` içinde `test.each` tablosu: `[girdi, country, text]`:

```ts
// TR
["34MHP923", "TR", "34 MHP 923"], ["38GZ189", "TR", "38 GZ 189"],
["06A12345", "TR", "06 A 12345"], ["34 mhp 923", "TR", "34 MHP 923"],
["12AB34", "TR", "12 AB 34"],          // NL sidecode 3 deseni ama il kodu → TR
["34ABC1234", "TR", "34 ABC 1234"],    // standart dışı TR yine TR
// Belçika
["1ABC123", "B", "1-ABC-123"], ["2XYZ987", "B", "2-XYZ-987"],
// Bulgaristan
["CA1234AB", "BG", "CA 1234 AB"], ["K1234AC", "BG", "K 1234 AC"],
// İngiltere
["AB12CDE", "UK", "AB12 CDE"],
// Hollanda (yalnız ünsüz harf kümesi)
["1BDF23", "NL", "1-BDF-23"], ["BD123F", "NL", "BD-123-F"], ["B123DF", "NL", "B-123-DF"],
["BDF12G", "NL", "BDF-12-G"], ["B12DFG", "NL", "B-12-DFG"], ["1BD234", "NL", "1-BD-234"],
["123BD4", "NL", "123-BD-4"], ["BD12FG", "NL", "BD-12-FG"], ["12BDFG", "NL", "12-BD-FG"],
// Almanya
["MAB1234", "D", "MAB 1234"], ["BAB123E", "D", "BAB 123E"], ["ABC123", "D", "ABC 123"],
// yedek: TR bandı, metin trim + büyük harf, olduğu gibi
["GU1234AB", "TR", "GU1234AB"],   // Avusturya, BG il kodu değil
["W12345A", "TR", "W12345A"],     // Avusturya
["AB123CD", "TR", "AB123CD"],     // Fransa/İtalya çakışması
["6ABC123", "TR", "6ABC123"],     // başında sıfır yok, B'ye düşmez
["  xyz  ", "TR", "XYZ"], ["", "TR", ""],
```

Ek test: `PLATE_COUNTRY_NAMES` altı kodun adını taşır (`D` → `"Almanya"`, `UK` → `"İngiltere"` …).

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/plate/country.test.ts`
Expected: FAIL — `Cannot find module './country'`

- [ ] **Step 3: Implement `detectPlate(plate: string): PlateInfo` in `src/lib/plate/country.ts`**

`c = normalizePlate(plate)`, sonra sıradaki desenler (`c` üzerinde, ilk eşleşen döner):

| Ülke | Desen | Metin |
|---|---|---|
| TR | `^(0[1-9]\|[1-7]\d\|8[01])([A-Z]{1,3})(\d{1,5})$` | `$1 $2 $3` |
| B | `^([12])([A-Z]{3})(\d{3})$` | `$1-$2-$3` |
| BG | `^(A\|B\|BH\|BP\|BT\|C\|CA\|CB\|CC\|CH\|CM\|CO\|CT\|E\|EB\|EH\|H\|K\|KH\|M\|OB\|P\|PA\|PB\|PK\|PP\|T\|TX\|X\|Y)(\d{4})([ABEHKMOPCTXY]{2})$` | `$1 $2 $3` |
| UK | `^([A-Z]{2})(\d{2})([A-Z]{3})$` | `$1$2 $3` |
| NL | `L = [BDFGHJKLNPRSTVXZ]`; sidecode 2,3,4,6–14 desenleri (aşağıda) | parçalar `-` ile |
| D | `^([A-ZÖÜ]{2,5})(\d{1,4})([EH]?)$` ve harf+rakam ≤ 8 | `$1 $2$3` |

NL desenleri (`9` = rakam, `X` = `L`): `99-99-XX`, `99-XX-99`, `XX-99-XX`, `99-XX-XX`, `99-XXX-9`, `9-XXX-99`, `XX-999-X`, `X-999-XX`, `XXX-99-X`, `X-99-XXX`, `9-XX-999`, `999-XX-9`. Her biri ayrı bir `RegExp` ve grupları `-` ile birleştiren bir dizi olarak yazılır. Hiçbiri eşleşmezse `{ country: "TR", text: plate.trim().toUpperCase() }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/plate/country.test.ts`
Expected: PASS (tüm satırlar)

- [ ] **Step 5: Commit**

```bash
git add src/lib/plate/
git commit -m "feat(#818): plakadan ülke tanıma (detectPlate)"
```

---

### Task 2: `Plate` bileşeni + stil + token'lar

**Files:**
- Create: `src/components/shared/plate.tsx`
- Create: `src/components/shared/plate.module.css`
- Modify: `src/app/globals.css` — ilk `:root {` bloğu (satır ~622), `--primary` grubundan sonra
- Test: `src/components/shared/plate.test.ts`

**Interfaces:**
- Consumes: `detectPlate`, `PLATE_COUNTRY_NAMES` (Task 1)
- Produces:
  ```ts
  export type PlateSize = "sm" | "md" | "lg"
  export function Plate(props: { plate: string; size?: PlateSize }): JSX.Element  // size default "md"
  ```
  Kök `<span>` nitelikleri: `data-plate-country={country}`, `data-size` (yalnız `sm`/`lg`'de; `md`'de yok).

- [ ] **Step 1: Write the failing test**

`renderToStaticMarkup(createElement(Plate, …))` ile (`bun test` CSS module sınıf adlarını çözmez, sınıfa değil nitelik/metne bak):

```ts
test("TR plakası bugünkü gibi: ülke metni yok", () => {
  const html = render({ plate: "34MHP923" })
  expect(html).toContain('data-plate-country="TR"')
  expect(html).toContain("34 MHP 923")
  expect(html).not.toContain("plakası")
  expect(html).not.toContain("data-size")
})
test("yabancı plaka bantta kodu, ekran okuyucuya ülke adını verir", () => {
  const html = render({ plate: "MAB1234", size: "lg" })
  expect(html).toContain('data-plate-country="D"')
  expect(html).toContain('data-size="lg"')
  expect(html).toMatch(/aria-hidden="true"[^>]*>D</)
  expect(html).toContain('<span class="sr-only">Almanya plakası </span>')
  expect(html).toContain("MAB 1234")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/components/shared/plate.test.ts`
Expected: FAIL — `Cannot find module './plate'`

- [ ] **Step 3: Implement `Plate` and `plate.module.css`**

Markup sırası: kök span → bant span (`aria-hidden="true"`, TR'de boş, yabancıda kod) → yabancıda `<span className="sr-only">{ad} plakası </span>` → metin.

CSS: `surface.module.css:643-701`deki `.plate`, `[data-size]` ve `.plateCountry` kurallarını birebir taşı. Bant artık her zaman var (bugünkü 7 çağrı yerinin hepsi `country` geçiyor). Ek kurallar:
- `.plate:not([data-plate-country="TR"]) .band`: `width: auto; min-width: 14px; padding: 0 3px; display: flex; align-items: center; justify-content: center; color: var(--primary-foreground); font-size: 8px; font-weight: 700; letter-spacing: 0`. `sm` → `min-width: 12px; font-size: 7px`, `lg` → `min-width: 16px; font-size: 9.5px`.
- `[data-plate-country="NL"]`: `background: var(--plate-nl); color: var(--plate-nl-foreground); border-color: var(--plate-nl-foreground)`.
- `[data-plate-country="B"]`: `background: var(--plate-be); color: var(--plate-be-foreground); border-color: var(--plate-be-foreground)`.

`globals.css` `:root` token'ları (yalnız `:root`; `.dark` miras alır, fiziksel plaka rengi):
`--plate-nl: #f7c600; --plate-nl-foreground: #111111; --plate-be: #ffffff; --plate-be-foreground: #a6192e;` ve bir satırlık yorumla neden `.dark`'ta tanımlanmadıkları.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/components/shared/plate.test.ts src/lib/theme-tokens.test.ts src/lib/ui-contract.test.ts`
Expected: PASS (`theme-tokens` yeni `plate-nl` ve `plate-be` çiftlerini ölçer, ≥ 4.5:1)

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/plate.tsx src/components/shared/plate.module.css src/components/shared/plate.test.ts src/app/globals.css
git commit -m "feat(#818): ülkeye göre stillenen Plate bileşeni"
```

---

### Task 3: Çağrı yerlerini taşı, eski bileşenleri sil

**Files:**
- Modify (DashPlate → Plate, `country` prop'u düşer, `size` aynen):
  `src/components/dashboard/longest-waiting.tsx:26`, `today-agenda.tsx:67`,
  `src/components/orders/order-list.tsx:301,589`,
  `src/components/intake/vehicle-entry-wizard.tsx:1485,1681`,
  `src/components/technician/technician-dashboard.tsx:379`
- Modify (PlateBadge → Plate; `size="sm"` → `sm`, varsayılan → `md`):
  `customers/customer-detail.tsx` (4), `purchases/purchases-list.tsx` (2, `sm`), `quotes/quote-list.tsx` (2), `quotes/quote-detail.tsx`, `appointments/appointment-list.tsx` (2), `appointments/appointment-detail.tsx`, `vehicles/vehicle-list.tsx` (2), `vehicles/vehicle-identity.tsx`, `reminders/reminder-list.tsx` (2), `reminders/reminder-detail.tsx`, `reminders/reminder-create-form.tsx`
- Modify: `src/components/vehicles/vehicle-passport.tsx:265`: `className="h-8 min-w-[6rem] text-sm"` → `size="lg"`
- Modify: `src/components/dashboard/surface.tsx`: `DashPlate` ve `formatTurkishPlate` importunu sil
- Modify: `src/components/dashboard/surface.module.css`: `.plate*` kurallarını (643-701) sil; `.rowStart:has(> .plate[data-size="lg"])` → `.rowStart:has(> [data-plate-country][data-size="lg"])`
- Modify: `src/components/shared/status-badge.tsx:63`: `PlateBadge` yeniden ihracını sil
- Delete: `src/components/shared/plate-badge.tsx`
- Test: `src/components/technician/technician-dashboard.test.ts:60`

**Interfaces:**
- Consumes: `Plate`, `PlateSize` (Task 2), import `@/components/shared/plate`

- [ ] **Step 1: Update the source-scan test first**

`technician-dashboard.test.ts:60` → `expect(source).toContain('<Plate plate={order.plate} size="lg" />')`

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test src/components/technician/technician-dashboard.test.ts`
Expected: FAIL on the plate assertion

- [ ] **Step 3: Migrate every call site and delete the old components**

- [ ] **Step 4: Verify nothing references the old names**

Run: `grep -rn "PlateBadge\|DashPlate\|formatTurkishPlate\|plate-badge" src --include='*.ts' --include='*.tsx' | grep -v "\.test\.ts"`
Expected: boş çıktı (test dosyalarındaki tarihçe yorumları kalabilir)

- [ ] **Step 5: Run the full gate**

Run: `bun test && bun run lint && bun run typecheck && bun run build`
Expected: tümü yeşil, lint 0 hata

- [ ] **Step 6: Browser QA** (worktree sunucusu `:3218`, `/api/auth/dev-login`)

390 ve 1440 genişlikte: `/dashboard` ("En uzun bekleyenler" ad sütunu hizalı, TR plakası ekran görüntüsündeki gibi), `/orders` (liste `sm` + kart `lg`), bir müşteri detayı (eski `PlateBadge` yeri), koyu tema. Yabancı görünüm için yerelde bir araç plakasını geçici olarak `MAB1234` / `12BDFG` yapıp bak, sonra geri al. Paylaşımlı dev DB'ye yazma; izole DB kullan.

- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "refactor(#818): tüm plaka rozetleri Plate kullanıyor; PlateBadge ve DashPlate kaldırıldı"
```
