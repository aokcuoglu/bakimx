# e-santral Ana Sayfa + Pazarlama UI Kiti — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/` ana sayfasını e-santral.com/bakimx'in birebir kopyası yapmak (yalnız §6.1 metin revizyonları ve §8 sapmaları farklı) ve sayfadan yeniden kullanılabilir bir pazarlama UI kiti çıkarmak. Issue #781.

**Architecture:** Kaynak değerler `globals.css`'te yalnız açık temada tanımlı `--mk-*` token'ları olur; kit (`src/components/marketing/kit/`) ve sayfa bölümleri (`src/components/marketing/landing/`) CSS modülleriyle bu token'lara bağlanır (CSS modülleri katmansız olduğu için Tailwind `@layer utilities` sınıflarını ezer). Etkileşimli her öğe shadcn/Radix bileşeninin üstüne kurulur. Bölümler sunucu bileşenidir; istemci adaları yalnız takip edilen CTA'lar, kart rayı, hero ölçekleme ve arama modalıdır. Arama modalı mevcut `POST /api/demo-request`'e `source: "landing_callback"` ile yazar.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, CSS Modules, shadcn/Radix (`Button`, `Dialog`, `Accordion`, `Input`, `Checkbox`, `Form`), react-hook-form + zod 4, `bun test` (`renderToStaticMarkup`), Playwright (`*.e2e.ts`).

**Spec:** `docs/superpowers/specs/2026-11-22-esantral-landing-design.md` — kaynak kopyası `docs/design/esantral-reference/{index.html,style.css,app.js}`. Ölçü/metin sorusu olduğunda önce bu ikisine bak.

## Global Constraints

- Tüm görünür metinler `docs/design/esantral-reference/index.html` ile kelimesi kelimesine aynı; tek istisna spec §6.1'deki üç metin (Task 7'de verbatim).
- Ölçüler `docs/design/esantral-reference/style.css` ile birebir (px, `clamp()`, `svh`, kırılımlar 960px ve 640px).
- Landing'de `framer-motion` yok; H1 ve hero CTA'ları sunucu HTML'inde görünür, `opacity:0` veya gizleyen sınıfla başlamaz.
- Ham `<button>/<input>/<details>/<dialog>` yok → `Button`, `Input`, `Checkbox`, `Accordion`, `Dialog`. `Link` düğme olarak: `<Button asChild><Link/></Button>`.
- Renk değerleri yalnız `globals.css` `--mk-*` token'larında; bileşen/CSS modülünde sabit hex yok (maket dahil).
- Metin/zemin çiftleri ≥ 4.5:1 (maket hariç — dekoratif, `aria-hidden`).
- Paylaşılan `Button`/`Input`/`Dialog` dosyaları değişmez (varsayılanlar global değişmez).
- Next 16: `next/image` için `priority` kullanma (deprecated); hero görseli `loading="eager"` + `fetchPriority="high"` (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`).
- Statik görseller `public/landing/esantral/` altında (middleware muaf).
- Formlar: react-hook-form + zod + shadcn `Form`; şema `src/lib/validations/`.
- Commit mesajı formatı: `feat(#781): …` / `test(#781): …` / `docs(#781): …`, sonunda `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Kapılar sırası: `bun test` → `bun run lint` (0 hata) → `bun run typecheck` → `bun run build`.

## Review Focus

1. **Arka arkaya gönderim / hız sınırı (429):** "Beni arayın"a iki kez basılır ya da dakikada 4. talep gelir → düğme istek sürerken devre dışı; 429'da modal açık kalır, değerler korunur, "Çok fazla istek. Lütfen biraz bekleyin." kırmızı satırda görünür. (Task 6 e2e: route 429 döndürür.)
2. **Yapıştırılan telefon biçimleri:** `+90 532 123 45 67`, `905321234567`, `5321234567` kabul; `0212 123 45 67` (sabit hat) ve 9 hane red. (Task 6 şema testi.)
3. **JS gelmeden / JS kapalı:** "Sizi arayalım" tetikleyicileri `/demo`'ya giden gerçek bağlantıdır; JS yüklenince tıklama modalı açar. (Task 6 render testi: `href="/demo"`.)
4. **Koyu tema sınıfı (`.dark`) ya da sistem koyu modu:** landing açık kalır; `--mk-*` `.dark` bloğunda tanımlanmaz, sayfa kökü kendi zemin/metin rengini verir. (Task 1 testi + Task 12 e2e `colorScheme: "dark"`.)
5. **Kısa/yatay ekranlar (375×667, 844×390):** hero `min-height: 560px`, metin telefonla çakışmaz, yatay taşma yok. (Task 12 e2e taşma kontrolü + ekran görüntüsü.)

---

### Task 1: Pazarlama token'ları ve kontrast kapısı

**Files:**
- Modify: `src/app/globals.css` (`:root` bloğu, `--muted-foreground-strong` civarındaki e-santral token'larından sonra; `.dark` bloğuna DOKUNMA)
- Test: `src/components/marketing/kit/tokens.test.ts`

**Interfaces:**
- Produces: CSS değişkenleri (aşağıdaki tablo). Sonraki tüm CSS modülleri yalnız bunları kullanır.

| Token | Değer |
|---|---|
| `--mk-ink` | `#1d1d1f` |
| `--mk-gray` | `#6e6e73` |
| `--mk-gray-hero` | `#646469` (hero alt metni; `#e7e9ed` üzerinde 4.84:1 — kaynaktaki `#6e6e73` 4.17:1) |
| `--mk-gray-3` | `#86868b` (yalnız maket ve input çerçevesi) |
| `--mk-surface` | `#ffffff` |
| `--mk-soft` | `#f5f5f7` |
| `--mk-hero` | `#e7e9ed` |
| `--mk-line` | `#d2d2d7` |
| `--mk-link` | `#0066cc` |
| `--mk-blue` | `#0071e3` |
| `--mk-blue-hover` | `#0066cc` (kaynakta `#0077ed`; beyaz metinle 4.32:1 → AA için koyu hover) |
| `--mk-neutral` / `--mk-neutral-hover` | `#e8e8ed` / `#dcdce1` |
| `--mk-focus-ring` | `0 0 0 4px rgb(0 113 227 / 0.18)` |
| `--mk-error` / `--mk-error-text` / `--mk-error-ring` | `#e30000` / `#d70015` / `0 0 0 4px rgb(227 0 0 / 0.1)` |
| `--mk-success-bg` / `--mk-success` | `#e6f5ea` / `#1b7a3d` |
| `--mk-info-bg` / `--mk-warn-bg` / `--mk-warn` | `#e8f0fe` / `#fff4e0` / `#a05a00` |
| `--mk-app-bg` / `--mk-row-line` / `--mk-tab-line` / `--mk-tab-idle` / `--mk-avatar-bg` / `--mk-whatsapp` | `#f2f2f7` / `#f0f0f3` / `#e5e5ea` / `#8e8e93` / `#dfe7ff` / `#25d366` |
| `--mk-r-input` / `--mk-r-card` / `--mk-r-tile` / `--mk-r-box` / `--mk-r-modal` | `12px` / `24px` / `28px` / `32px` / `30px` |
| `--mk-h1` / `--mk-h2` | `clamp(32px, min(5.4vw, 7svh), 76px)` / `clamp(32px, 3.4vw, 48px)` |

- [ ] **Step 1: Write the failing test** — `tokens.test.ts` `globals.css`'i okur, `:root` içindeki `--mk-<ad>: #rrggbb` değerlerini ayrıştırır (yerel WCAG kontrast fonksiyonu; `theme-tokens.test.ts:87-100` ile aynı formül).

```ts
test("pazarlama metin/zemin çiftleri AA (4.5:1) geçer", () => {
  const pairs: [fg: string, bg: string][] = [
    ["ink", "surface"], ["gray", "surface"], ["gray", "soft"], ["gray-hero", "hero"],
    ["link", "surface"], ["link", "soft"], ["link", "hero"], ["surface", "blue"],
    ["surface", "blue-hover"], ["success", "success-bg"], ["warn", "warn-bg"],
    ["link", "info-bg"], ["error-text", "surface"], ["ink", "neutral"],
  ]
  for (const [fg, bg] of pairs) expect(contrast(tok(fg), tok(bg))).toBeGreaterThanOrEqual(4.5)
})
test("pazarlama token'ları yalnız açık temada tanımlı", () => {
  expect(darkBlock(css)).not.toContain("--mk-")
})
```

- [ ] **Step 2: Run** `bun test src/components/marketing/kit/tokens.test.ts` — Expected: FAIL (token bulunamadı).
- [ ] **Step 3: Implement** token bloğunu `globals.css` `:root`'a ekle; üstüne bir yorum: kaynak, açık temaya sabit olduğu, `--mk-gray-hero` ve `--mk-blue-hover` sapma gerekçeleri.
- [ ] **Step 4: Run** aynı test + `bun test src/lib/theme-tokens.test.ts src/app/design/design-system.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(#781): pazarlama token'ları ve kontrast kapısı`

---

### Task 2: Kit — eylem öğeleri ve wordmark

**Files:**
- Create: `src/components/marketing/kit/kit.module.css`, `cta-track.ts`, `pill-button.tsx`, `text-link.tsx`, `round-icon-button.tsx`, `wordmark.tsx`, `index.ts`
- Create: `public/landing/esantral/bakimx-x.svg`, `public/landing/esantral/bakimx-icon.svg` (`curl -sL https://e-santral.com/bakimx/img/<ad> -o public/landing/esantral/<ad>`)
- Modify: `src/lib/marketing-analytics.ts:32` — `demo_cta_click.destination` birliğine `"callback_modal"` ekle
- Test: `src/components/marketing/kit/actions.test.ts`

**Interfaces:**
- Produces:
  - `type CtaTrack = { name: "trial_cta_click"; location: string } | { name: "demo_cta_click"; location: string; destination: "form" | "assistant" | "callback_modal" }` + `trackCta(track: CtaTrack): void` (`cta-track.ts`, `trackMarketingEvent` çağırır: `cta_location: location`).
  - `PillButton(props: { href?: string; size?: "md" | "lg" | "nav"; track?: CtaTrack; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean; fullWidth?: boolean; className?: string; children: ReactNode })` — `"use client"`. `href` varsa `<Button asChild><Link/></Button>`, yoksa `<Button>`. Ölçüler: md 44px/0 22px/17px-500, lg 50px/0 28px, nav `10px 18px` 15px-600 (≤640: `8px 14px` 14px). Hover `--mk-blue-hover`, odak `--mk-focus-ring`.
  - `TextLink(props: { href?: string; track?: CtaTrack; onClick?: () => void; className?: string; children: ReactNode })` — `"use client"`; metnin sonuna `" ›"` ekler; renk `--mk-link`, hover alt çizgi. `href` yoksa `<Button variant="link">` (modül sınıfıyla sıfırlanmış).
  - `RoundIconButton(props: { label: string; size?: 44 | 32; onClick?: () => void; disabled?: boolean; children: ReactNode })` — `<Button variant="secondary" size="icon" aria-label={label}>`, zemin `--mk-neutral`, disabled `opacity .35`.
  - `Wordmark(props: { variant: "header" | "footer" | "inline"; href?: string })` — "Bakım" + `<img src="/landing/esantral/bakimx-x.svg" alt="X">` (`next/image` `unoptimized`), X yüksekliği `.71em`; header 23px/800/−0.035em (≤640 20px), footer 18px, inline font boyunu devralır. `href` varsa `aria-label="BakımX, başa dön"`.

- [ ] **Step 1: Write the failing test** (`renderToStaticMarkup`, `highlight-card.test.ts` deseni):

```ts
test("PillButton href ile tek bir bağlantı üretir, iç içe düğme yok", () => {
  const html = render(createElement(PillButton, { href: "/register" }, "Ücretsiz deneyin"))
  expect(html).toContain('href="/register"'); expect(html).not.toContain("<button")
})
test("TextLink sona › ekler", () => {
  expect(render(createElement(TextLink, { href: "/demo" }, "Sizi arayalım"))).toContain("Sizi arayalım ›")
})
test("RoundIconButton erişilebilir ad taşır", () => {
  expect(render(createElement(RoundIconButton, { label: "Önceki kart" }, "‹"))).toContain('aria-label="Önceki kart"')
})
test("Wordmark başa dönüş etiketi ve X logosu", () => {
  const html = render(createElement(Wordmark, { variant: "header", href: "#hero" }))
  expect(html).toContain('aria-label="BakımX, başa dön"'); expect(html).toContain("bakimx-x.svg")
})
```

- [ ] **Step 2: Run** `bun test src/components/marketing/kit/actions.test.ts` — Expected: FAIL (modül yok).
- [ ] **Step 3: Implement** yukarıdaki imzalar + `kit.module.css` (yalnız `var(--mk-*)`).
- [ ] **Step 4: Run** test — Expected: PASS. `bun run typecheck` temiz.
- [ ] **Step 5: Commit** `feat(#781): pazarlama kiti eylem öğeleri ve wordmark`

---

### Task 3: Kit — içerik blokları

**Files:**
- Create: `src/components/marketing/kit/feature-tile.tsx`, `photo-card.tsx`, `photo-rail.tsx`, `numbered-steps.tsx`, `check-list.tsx`, `price-block.tsx`, `faq-accordion.tsx` (+ `kit.module.css`'e stiller, `index.ts`'e export)
- Test: `src/components/marketing/kit/blocks.test.ts`

**Interfaces:**
- Consumes: Task 2 `RoundIconButton`.
- Produces:
  - `FeatureTile({ icon: ReactNode; title: string; children: ReactNode })` — `--mk-soft`, `--mk-r-tile` (≤640 22px), dolgu `34px 30px 36px` (≤640 `26px 24px 28px`), ikon 34px `stroke: var(--mk-blue)` 1.7, h3 22/700/−0.025em mt 22, p 17 `--mk-gray` mt 8.
  - `PhotoCard({ src: string; alt: string; label: string; children: ReactNode })` — `next/image` `fill`, `sizes="(max-width: 640px) 82vw, 380px"`, lazy; 380px (≤640 82vw), 4:5, `--mk-r-card`, alt degrade (`inset 45% 0 0`, kaynaktaki üç durak), sol üst hap etiket, alt beyaz metin 17/500 (≤640 16).
  - `PhotoRail({ title: ReactNode; titleId: string; children: ReactNode })` — `"use client"`; başlık + iki `RoundIconButton` ("Önceki kart" / "Sonraki kart", ≤640 gizli); ray `role="region"` `aria-labelledby={titleId}` `tabIndex={0}`, yatay snap, kaydırma çubuğu gizli, gap 20; ok adımı = ilk kart genişliği + 20, `behavior: "smooth"`; başta önceki, sonda sonraki `disabled` (2px tolerans), scroll/resize'da güncellenir.
  - `NumberedSteps({ steps: { title: string; text: string }[] })` — `<ol>`, 36px beyaz daire mavi sayı, satırlar arası `--mk-line`.
  - `CheckList({ items: string[] })` — 2 kolon `minmax(0,280px)` (≤640 1), 20px mavi daire içinde beyaz tik (kaynaktaki inline SVG data-URI).
  - `PriceBlock({ titleId: string; title: string; subtitle: string; amount: string; unit: string; items: string[]; cta: ReactNode; note: string })`.
  - `FaqAccordion({ items: { question: string; answer: string }[] })` — Radix `Accordion type="single" collapsible`, `AccordionItem value={\`faq-${i}\`}`; yalnız alt çizgi `--mk-line`, soru 19/600 (≤640 17, dolgu 22/18px), 12px chevron 45° → −135°, cevap `--mk-gray`, `max-width: 62ch`.

- [ ] **Step 1: Write the failing test:**

```ts
test("NumberedSteps sıralı liste ve her adım", () => {
  const html = render(createElement(NumberedSteps, { steps: [{ title: "A", text: "a" }, { title: "B", text: "b" }, { title: "C", text: "c" }] }))
  expect(html).toContain("<ol"); expect(html.match(/<li/g)).toHaveLength(3)
})
test("PriceBlock tutar ve birim", () => {
  const html = render(createElement(PriceBlock, { titleId: "fiyat-t", title: "Tek paket, her zaman.", subtitle: "s", amount: "₺1.499", unit: "/ ay, KDV dahil", items: ["x"], cta: null, note: "Kart bilgisi istenmez." }))
  expect(html).toContain("₺1.499"); expect(html).toContain("/ ay, KDV dahil"); expect(html).toContain('aria-labelledby="fiyat-t"')
})
test("FaqAccordion her soruyu tetikleyici olarak basar", () => {
  const html = render(createElement(FaqAccordion, { items: [{ question: "Q1", answer: "A1" }, { question: "Q2", answer: "A2" }] }))
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(2)
})
test("PhotoRail kaydırılabilir bölgeyi başlığa bağlar", () => {
  const html = render(createElement(PhotoRail, { title: "T", titleId: "nasil-t" }, null))
  expect(html).toContain('role="region"'); expect(html).toContain('aria-labelledby="nasil-t"'); expect(html).toContain('tabindex="0"')
})
```

- [ ] **Step 2: Run** `bun test src/components/marketing/kit/blocks.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** imzalar + stiller.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(#781): pazarlama kiti içerik blokları`

---

### Task 4: Kit — yüzen etiketli alan, modal, başarı durumu

**Files:**
- Create: `src/components/marketing/kit/floating-field.tsx`, `marketing-dialog.tsx`, `success-state.tsx` (+ stiller, export)
- Test: `src/components/marketing/kit/form-kit.test.ts`

**Interfaces:**
- Produces:
  - `FloatingField(props: React.ComponentProps<typeof Input> & { label: string; trailing?: ReactNode })` — `<label>` sarmalayıcı; tüm kalan props (Slot'tan gelen `id`, `aria-invalid`, `aria-describedby` dahil) `<Input placeholder=" ">`'e yayılır; 58px, dolgu `24px 16px 6px`, `--mk-r-input`, çerçeve `--mk-gray-3`; etiket 17px `top:18px` → odakta/doluyken 12px `top:9px` (`:focus`, `:not(:placeholder-shown)`), odakta etiket `--mk-blue` + `--mk-focus-ring`; `aria-invalid="true"` → `--mk-error` çerçeve + `--mk-error-ring`.
  - `MarketingDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; titleId: string; size?: "md" | "sm"; onOpenAutoFocus?: (e: Event) => void; children: ReactNode })` — `Dialog` + `DialogContent showCloseButton={false}`; genişlik md 500 / sm 460 (`100% - 32px`), `--mk-r-modal`, gölge `0 40px 100px -30px rgb(0 0 0 / .45)`, overlay `rgb(0 0 0 / .32)` + `blur(10px) saturate(140%)`, giriş `translateY(18px) scale(.98)` → 0 / 320ms `cubic-bezier(.2,.8,.2,1)` (`prefers-reduced-motion` → yok); ≤640: tam genişlik alttan sheet, `26px 26px 0 0`, `max-height: 94svh`; gövde dolgusu `44px 44px 36px` (≤640 `36px 20px 28px`); sağ üstte `DialogClose asChild` + `RoundIconButton size={32} label="Kapat"`.
  - `SuccessState(props: { titleId: string; title: string; text: string; onDone: () => void })` — 64px `--mk-success-bg` daire + `--mk-success` tik, başlık 30/700 (≤640 26), metin 17 `--mk-gray`, `PillButton size="lg"` "Tamam".

- [ ] **Step 1: Write the failing test:**

```ts
test("FloatingField alan özniteliklerini Input'a geçirir", () => {
  const html = render(createElement(FloatingField, { label: "Ad soyad", id: "cb-name", "aria-invalid": true, name: "name" }))
  expect(html).toMatch(/<input[^>]*id="cb-name"[^>]*aria-invalid="true"|<input[^>]*aria-invalid="true"[^>]*id="cb-name"/)
  expect(html).toContain('placeholder=" "'); expect(html).toContain("Ad soyad")
})
test("SuccessState başlığı ve Tamam düğmesi", () => {
  const html = render(createElement(SuccessState, { titleId: "t", title: "Teşekkürler.", text: "x", onDone: () => {} }))
  expect(html).toContain("Teşekkürler."); expect(html).toContain("Tamam")
})
```

- [ ] **Step 2: Run** `bun test src/components/marketing/kit/form-kit.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(#781): pazarlama kiti form alanı, modal ve başarı durumu`

---

### Task 5: Demo talebi — "Sizi arayalım" kaynağı için gevşek doğrulama

**Files:**
- Create: `src/lib/demo-request/validate.ts`
- Modify: `src/app/api/demo-request/route.ts:24-59` (yerel `DemoRequestBody` + `validateBody` yeni modüle taşınır; `persist` içindeki alanlar `normalizeDemoRequestBody` çıktısından okunur)
- Test: `src/lib/demo-request/validate.test.ts`

**Interfaces:**
- Produces:
  - `type DemoRequestSource = "demo_page" | "landing_callback"`
  - `interface DemoRequestBody { source?: DemoRequestSource; name: string; businessName?: string; phone: string; city?: string; monthlyVehicles?: string; notes?: string; targetingConsent?: boolean; attribution?: unknown }` (route'taki mevcut alanlarla birebir + `source`)
  - `validateDemoRequestBody(body: DemoRequestBody): Record<string, string>` — `source !== "landing_callback"` iken bugünkü kurallar ve mesajlar AYNEN; `"landing_callback"` iken yalnız `name` (≥2) ve `phone` (`/^[0-9+\-\s()]{7,15}$/`) zorunlu.
  - `normalizeDemoRequestBody(body: DemoRequestBody): { name: string; businessName: string; phone: string; city: string; monthlyVehicles: string; notes: string | null }` — trim; eksik isteğe bağlı alanlar `""`; `landing_callback` iken `notes = ["Ana sayfa · Sizi arayalım", body.notes?.trim()].filter(Boolean).join(" — ")`.

- [ ] **Step 1: Write the failing test:**

```ts
test("demo sayfası kuralları değişmedi", () => {
  expect(validateDemoRequestBody({ name: "Ali Veli", phone: "05321234567" })).toEqual({
    businessName: "İşletme adı en az 2 karakter olmalıdır", city: "Şehir seçimi yapın", monthlyVehicles: "Aylık araç adedi seçin",
  })
})
test("landing_callback yalnız ad ve telefon ister", () => {
  expect(validateDemoRequestBody({ source: "landing_callback", name: "Ali Veli", phone: "0532 123 45 67" })).toEqual({})
  expect(validateDemoRequestBody({ source: "landing_callback", name: "A", phone: "x" })).toHaveProperty("name")
})
test("landing_callback kaydı boş dizeler ve kaynak notuyla normalize edilir", () => {
  expect(normalizeDemoRequestBody({ source: "landing_callback", name: " Ali Veli ", phone: "0532 123 45 67" })).toEqual({
    name: "Ali Veli", businessName: "", phone: "0532 123 45 67", city: "", monthlyVehicles: "", notes: "Ana sayfa · Sizi arayalım",
  })
})
```

- [ ] **Step 2: Run** `bun test src/lib/demo-request/validate.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** modül + route'u ona bağla (hız sınırı, attribution, transaction, `salesLead` aynı kalır). Prisma şeması DEĞİŞMEZ (kolonlar `String`, `""` saklanır).
- [ ] **Step 4: Run** test + `bun test src/lib/test-mock-isolation.test.ts src/lib/rbac-coverage.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(#781): demo talebine ana sayfa arama kaynağı`

---

### Task 6: "Sizi arayalım" modalı ve tetikleyiciler

**Files:**
- Create: `src/lib/validations/callback-request.ts`, `src/components/marketing/landing/callback-dialog.tsx`
- Test: `src/lib/validations/callback-request.test.ts`, `src/components/marketing/landing/callback-dialog.test.ts`

**Interfaces:**
- Consumes: Task 2 `PillButton`, `TextLink`, `CtaTrack`; Task 4 `MarketingDialog`, `FloatingField`, `SuccessState`; Task 5 body sözleşmesi; `normalizePhone`, `formatPhoneTR` (`src/lib/format.ts:48,70`).
- Produces:
  - `callbackRequestSchema` (zod 4): `name` — trim, boşlukla en az 2 parça, mesaj `"Adınızı ve soyadınızı yazın."`; `phone` — `normalizePhone(v)` `/^5\d{9}$/`, mesaj `"Cep telefonu numaranızı 05xx xxx xx xx biçiminde yazın."`; `consent` — `true` olmalı, mesaj `"Devam etmek için onay kutusunu işaretleyin."`. `type CallbackRequest = z.infer<typeof callbackRequestSchema>`.
  - `CallbackDialogProvider({ children })` — `"use client"`; tek `MarketingDialog size="sm" titleId="call-t"`; context `{ open(location: string): void }`.
  - `CallbackTrigger(props: { variant: "text" | "pill" | "pill-lg"; location: string; children: ReactNode })` — `"use client"`; `href="/demo"` (JS'siz yedek); tıklamada `preventDefault` + `trackCta({ name: "demo_cta_click", location, destination: "callback_modal" })` + `open(location)`. Provider yoksa düz `/demo` bağlantısı gibi davranır.
- Modal içeriği (kaynak `#call`): `bakimx-icon.svg` 44px, `h2#call-t` "Sizi arayalım", alt metin "Servisinizi birlikte inceleyelim, geçişi planlayalım. En kısa sürede sizi arayalım." (masaüstünde `<br>` sonrası ikinci cümle; ≤640 tek akış), `FloatingField` Ad soyad (`autoComplete="name"`) ve Cep telefonu (`type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, `onChange` → `formatPhoneTR`), `Checkbox` + "Bu numaradan aranmayı ve [KVKK aydınlatma metnini](/kvkk) kabul ediyorum.", hata satırı, `PillButton size="lg" type="submit" fullWidth` "Beni arayın".
- Davranış: her açılışta `form.reset()` + form görünümü; `onOpenAutoFocus` → ad alanına odak; doğrulama hatasında alanlar `aria-invalid`, ilk mesaj tek kırmızı satırda (`<Alert variant="destructive">`, kit sınıfıyla tek satır görünüm), ilk hatalı alana odak; gönderimde düğme `disabled`; `fetch("/api/demo-request", { method: "POST", body: JSON.stringify({ source: "landing_callback", name, phone }) })`; 2xx → `trackMarketingEvent("demo_submitted", { form_location: "home" })` + `SuccessState` ("Teşekkürler." / "Arama talebiniz alındı. En kısa sürede sizi arayacağız."); 4xx/5xx → yanıttaki `errors._general` ya da `"Talebiniz gönderilemedi. Lütfen tekrar deneyin."`, değerler korunur. Kapanınca odak açan öğeye döner (Radix varsayılanı).

- [ ] **Step 1: Write the failing tests:**

```ts
// callback-request.test.ts
test.each(["+90 532 123 45 67", "905321234567", "5321234567", "0532 123 45 67"])("cep %s kabul", (phone) => {
  expect(callbackRequestSchema.safeParse({ name: "Ali Veli", phone, consent: true }).success).toBe(true)
})
test.each(["0212 123 45 67", "532123456"])("geçersiz %s red", (phone) => {
  expect(callbackRequestSchema.safeParse({ name: "Ali Veli", phone, consent: true }).success).toBe(false)
})
test("tek kelime ad ve onaysız gönderim red", () => {
  expect(callbackRequestSchema.safeParse({ name: "Ali", phone: "05321234567", consent: true }).success).toBe(false)
  expect(callbackRequestSchema.safeParse({ name: "Ali Veli", phone: "05321234567", consent: false }).success).toBe(false)
})
// callback-dialog.test.ts
test("tetikleyici JS'siz /demo'ya gider", () => {
  const html = render(createElement(CallbackDialogProvider, null, createElement(CallbackTrigger, { variant: "text", location: "hero_secondary" }, "Sizi arayalım")))
  expect(html).toContain('href="/demo"'); expect(html).toContain("Sizi arayalım ›")
})
```

- [ ] **Step 2: Run** `bun test src/lib/validations/callback-request.test.ts src/components/marketing/landing/callback-dialog.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `form.watch()` kullanırsan `repo-guardrails.md` §1'deki dosya başı `eslint-disable` desenini uygula.
- [ ] **Step 4: Run** — Expected: PASS; `bun run lint` 0 hata.
- [ ] **Step 5: Commit** `feat(#781): Sizi arayalım modalı`

---

### Task 7: Sayfa içeriği ve görseller

**Files:**
- Create: `src/components/marketing/landing/content.ts`, `src/components/marketing/landing/feature-icons.tsx`
- Create: `public/landing/esantral/{eller-telefon,kabul,parca,teslim,usta}.webp` (`curl -sL https://e-santral.com/bakimx/img/<ad>.webp -o …`; `-800` varyantları alınmaz, `next/image` srcset üretir)
- Test: `src/components/marketing/landing/content.test.ts`

**Interfaces:**
- Produces (`content.ts`, hepsi `as const`): `LANDING_DESCRIPTION`, `NAV: { label: string; id: "nasil" | "ozellikler" | "fiyat" | "sorular" }[]`, `HERO`, `MOCKUP` (atölye adı, tarih satırı, 3 KPI, 4 satır `{ plate, car, job, status: "info" | "warn" | "ok", label }`, 3 bildirim, 4 sekme), `DAY_CARDS` (4: `{ img, alt, label, text }`), `FEATURE_TILES` (6: `{ icon: FeatureIconName, title, text }`), `MOVE` (`title`, `dim`, `text`, 3 `steps`), `PRICE` (`title`, `subtitle`, `amount`, `unit`, `items`, `note`, `monthlyPriceTry: 1499`), `LANDING_FAQ` (5), `FINAL`.
  - `FeatureIcon({ name: FeatureIconName })` — `feature-icons.tsx`; altı kaynak SVG'nin path'leri birebir (`index.html` `.tile svg`), `aria-hidden`.
- Metinler `index.html`'den kelimesi kelimesine; **yalnız şu üçü farklı (verbatim):**
  - `PRICE.subtitle` = `"Servisinizin günlük işi için gereken her şey dahil. Kademeli paket, gizli ücret yok."`
  - `PRICE.items[1]` = `"Ruhsat okuma ile hızlı araç kabul"`
  - `LANDING_FAQ[0].answer` = `"Tek paket var: servisinizi yönetmek için gereken her şey aylık ₺1.499'a (KDV dahil) dahildir. Şaseden parça sorgulama gibi ek maliyetli hizmetleri isterseniz uygulama içinden ayrıca alabilirsiniz."`

- [ ] **Step 1: Write the failing test:**

```ts
test("fiyat metni tek paket ve ek ücret vaadi yok", () => {
  expect(PRICE.amount).toBe("₺1.499"); expect(PRICE.unit).toBe("/ ay, KDV dahil")
  const all = JSON.stringify({ PRICE, LANDING_FAQ })
  expect(all).not.toContain("Ek modül"); expect(all).not.toContain("bütün özellikler")
})
test("SSS kaynaktaki beş soru", () => {
  expect(LANDING_FAQ.map((f) => f.question)).toEqual([
    "Fiyata neler dahil?", "Müşteriye WhatsApp'tan ne gönderiliyor?", "Ekibim de kullanabilir mi?",
    "e-Fatura kesebilir miyim?", "Hangi cihazlarda çalışır?",
  ])
})
test("görseller public/landing/esantral altında mevcut", () => {
  for (const c of DAY_CARDS) expect(existsSync(join(PUBLIC, c.img))).toBe(true)
})
```

- [ ] **Step 2: Run** `bun test src/components/marketing/landing/content.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** + görselleri indir (`file public/landing/esantral/*` ile WebP/SVG olduklarını doğrula).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(#781): ana sayfa içeriği ve görselleri`

---

### Task 8: Sayfa bölümleri

**Files:**
- Create (`src/components/marketing/landing/`): `landing.module.css`, `landing-header.tsx`, `hero.tsx`, `hero-fit.tsx`, `app-mockup.tsx`, `day-strip.tsx`, `features.tsx`, `move.tsx`, `price.tsx`, `faq.tsx`, `final-cta.tsx`, `landing-footer.tsx`
- Test: `src/components/marketing/landing/sections.test.ts`

**Interfaces:**
- Consumes: Task 2–4, 6, 7.
- Produces: her bölüm parametresiz bir bileşen (`LandingHeader`, `Hero`, `DayStrip`, `Features`, `Move`, `Price`, `Faq`, `FinalCta`, `LandingFooter`); çapalar `id="hero" | "nasil" | "ozellikler" | "gecis" | "fiyat" | "sorular"`.
- Bölüm → kaynak eşlemesi (ölçüler `style.css`'teki aynı adlı kurallar): `LandingHeader` ↔ `.top/.top-in/.nav/.acts/.pill-btn`; `Hero` ↔ `.d-hero/.d-in/.d-sub/.d-cta/.hand*`; `AppMockup` ↔ `.d-screen` ve altı; `DayStrip` ↔ `.d-strip/.d-head/.d-cards/.d-card`; `Features` ↔ `.sec/.title/.tiles`; `Move` ↔ `.move*`; `Price` ↔ `.price/.amount/.incl`; `Faq` ↔ `.faq*`; `FinalCta` ↔ `.final`; `LandingFooter` ↔ `.foot*`.
- Bağlantılar ve takip konumları: üst bant "Giriş yap" → `/login`; "Ücretsiz deneyin" → `/register` (`trial_cta_click`: `header`, `hero_primary`, `move_secondary`, `price`, `final`); `CallbackTrigger` konumları `hero_secondary` (text), `move_primary` (pill-lg); "WhatsApp'tan sorun" → `getSupportWhatsAppUrl("Merhaba, BakımX hakkında bilgi almak istiyorum.")` (`target="_blank" rel="noopener noreferrer"`).
- Alt bant: wordmark, 4 çapa + Giriş yap, `© 2026 BakımX`, ek satırda KVKK aydınlatma metni (`/kvkk`), Gizlilik (`/privacy`), Kullanım koşulları (`/terms`) — aynı 13px gri stil.
- `Hero`: sunucu bileşeni; H1 iki satır (`<br>`), hiçbir gizleme sınıfı yok. Fotoğraf `next/image` 1672×941, `loading="eager"`, `fetchPriority="high"`, `sizes="100vw"`, alt "Ustanın elinde BakımX açık telefon". `HeroFit` (`"use client"`) `ResizeObserver` ile hero'ya `--text` (metin bloğu yüksekliği + `clamp(44px, 6vh, 72px)`) ve ekran deliğine `--s` (`delik genişliği / 350`, 4 hane) yazar; CSS varsayılanları `--text: 380px` (≤640 360px), `--s: .7`.
- `AppMockup`: kapsayıcı `role="img"` `aria-label="BakımX uygulama ekranı: bugün serviste 7 araç, 3 hazır, iş emirleri ve bildirimler"`, iç içerik `aria-hidden="true"`; plaka rozeti, durum hapları (`--mk-info-bg/--mk-link`, `--mk-warn-bg/--mk-warn`, `--mk-success-bg/--mk-success`), WhatsApp/takvim/stok ikonları ve sekme SVG'leri kaynaktan birebir.
- Kaydırınca belirme: `Features` kutuları, `Move` ve `Price` kutusu `Reveal` (`components/shared/reveal.tsx`) içinde; hero ve başlıklar ASLA.

- [ ] **Step 1: Write the failing test:**

```ts
test("hero başlığı sunucu HTML'inde görünür ve gizli başlamaz", () => {
  const html = render(createElement(CallbackDialogProvider, null, createElement(Hero)))
  const h1 = html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? ""
  expect(h1).toContain("Oto servisinizi"); expect(h1).toContain("telefonunuzdan yönetin.")
  expect(html).not.toMatch(/opacity:\s*0/)
})
test("çapalar ve CTA hedefleri", () => {
  const html = render(createElement(CallbackDialogProvider, null, createElement(LandingHeader), createElement(Price), createElement(LandingFooter)))
  for (const href of ['href="#nasil"', 'href="#ozellikler"', 'href="#fiyat"', 'href="#sorular"', 'href="/login"', 'href="/register"', 'href="/kvkk"', 'href="/privacy"', 'href="/terms"']) expect(html).toContain(href)
  expect(html).toContain("₺1.499")
})
test("maket ekran okuyucuya tek görsel olarak sunulur", () => {
  const html = render(createElement(AppMockup))
  expect(html).toContain('role="img"'); expect(html).toContain('aria-hidden="true"')
})
```

- [ ] **Step 2: Run** `bun test src/components/marketing/landing/sections.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** bölümleri.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(#781): ana sayfa bölümleri`

---

### Task 9: `/` sayfasının bağlanması

**Files:**
- Modify: `src/app/page.tsx` (tamamı), `src/app/page.test.ts` (yeniden yazılır)
- Modify: `src/lib/faq-data.ts` (`showOnLanding` alanı ve `LANDING_FAQ_ITEMS` kaldırılır), `src/lib/faq-data.test.ts` (landing testi silinir)
- Modify: `src/components/sections/Header.tsx:13,15`, `src/components/sections/Footer.tsx:97-98` — yalnız href: `/#neden` → `/#nasil`, `/#sss` → `/#sorular`

**Interfaces:**
- Consumes: Task 6 `CallbackDialogProvider`, Task 7 `LANDING_DESCRIPTION`/`LANDING_FAQ`/`PRICE`, Task 8 bölümleri.
- `page.tsx`: `PublicSite` KULLANILMAZ (framer-motion ilerleme çubuğu); kök `<div className={styles.page}>` (beyaz zemin, `--mk-ink`, 17px/1.5, −0.01em; ≤640 16px). `metadata` = `publicPageMetadata({ path: "/", title: "Oto Servis Yönetim Platformu", description: LANDING_DESCRIPTION })` + `title: { absolute: HOME_TITLE }`. JSON-LD: mevcut `Organization` + `LANDING_FAQ`'tan `FAQPage` + `SoftwareApplication` (`offers: { "@type": "Offer", price: "1499", priceCurrency: "TRY", url: \`${SITE_URL}/register\` }`).
- Site asistanı ve çerez bandı kök layout'tan gelir; dokunulmaz.

- [ ] **Step 1: Rewrite `page.test.ts`** (kaynak tarama; `read(path)` = `readFileSync` kökten, `landingFiles()` = `src/components/marketing/landing/` altındaki test olmayan `.ts/.tsx` dosyaları):

```ts
test("ana sayfa framer-motion ve PublicSite kullanmaz", () => {
  expect(read("src/app/page.tsx")).not.toMatch(/framer-motion|PublicSite/)
  for (const f of landingFiles()) expect(read(f)).not.toContain("framer-motion")
})
test("JSON-LD fiyatı içerikteki fiyatla aynı", () => {
  expect(read("src/app/page.tsx")).toContain("PRICE.monthlyPriceTry")
})
test("CTA konumları takip edilir", () => {
  const src = landingFiles().map(read).join("\n")
  for (const loc of ["header", "hero_primary", "hero_secondary", "move_primary", "move_secondary", "price", "final"]) expect(src).toContain(`"${loc}"`)
})
test("eski çapalar kalmadı", () => {
  expect(read("src/components/sections/Header.tsx")).not.toMatch(/\/#(neden|sss)"/)
  expect(read("src/components/sections/Footer.tsx")).not.toMatch(/\/#(neden|sss)"/)
})
```

- [ ] **Step 2: Run** `bun test src/app/page.test.ts src/lib/faq-data.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `page.tsx`, faq-data temizliği, href güncellemeleri.
- [ ] **Step 4: Run** aynı testler + `bun run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(#781): ana sayfa e-santral düzenine geçti`

---

### Task 10: Kullanılmayan eski landing bileşenlerinin silinmesi

**Files:**
- Delete: `src/components/sections/` altında Task 9 sonrası **hiçbir yerden import edilmeyen** dosyalar (aday: `HeroSection.tsx`, `LandingContent.tsx`, `FAQSection.tsx`, `ProductStage.tsx`, `hero-workshop.tsx`, `mac-window.tsx`, `mock-app-demo.tsx`, `HeroAskBar.tsx`, `landing-editorial.module.css` ve yalnız bunların kullandığı CSS/yardımcılar)

- [ ] **Step 1: Listele** — her aday için `grep -rn "<dosya-adı-uzantısız>" src e2e --include='*.ts' --include='*.tsx' --include='*.css'` çıktısında yalnız kendisi/kendi testi kalıyorsa silinecekler listesine al. Başka sayfada kullanılan (`/oto-servis-programi`, `/demo` vb.) dosyaya DOKUNMA.
- [ ] **Step 2: Sil** ve `bun run typecheck && bun run lint && bun test` — Expected: hepsi yeşil.
- [ ] **Step 3: Commit** `refactor(#781): kullanılmayan eski landing bileşenleri`

---

### Task 11: `/design` vitrini ve tasarım belgesi

**Files:**
- Create: `src/app/design/marketing-kit.tsx`
- Modify: `src/app/design/page.tsx` (son `Section`'dan sonra `<Section id="marketing" index="09" title="Pazarlama kiti (e-santral)" eyebrow="Marketing">`)
- Modify: `docs/design-pattern-esantral.md` (yeni "## 7. Pazarlama ölçeği" bölümü: Task 1 token tablosu, düğme ölçüleri 44/50/nav, köşeler, başlık ölçeği, iki AA sapması, kit bileşen listesi ve dosya yolları)
- Test: `src/app/design/design-system.test.ts` (yeni test)

**Interfaces:**
- Consumes: kit `index.ts` export'ları.
- `MarketingKitShowcase()` — token örnekleri (ad + değer, `CopyableSwatch` deseni `copyable-swatch.tsx`), PillButton md/lg/nav, TextLink, RoundIconButton 44/32, FeatureTile, PhotoCard (bir görsel), NumberedSteps, CheckList, PriceBlock, FaqAccordion (2 madde), FloatingField (boş/dolu/hatalı), SuccessState. Arka plan beyaz kutu içinde (pazarlama açık tema).

- [ ] **Step 1: Write the failing test:** `expect(read("src/app/design/page.tsx")).toContain('id="marketing"')` ve `expect(read("docs/design-pattern-esantral.md")).toContain("## 7. Pazarlama ölçeği")`.
- [ ] **Step 2: Run** `bun test src/app/design/design-system.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(#781): pazarlama kiti vitrini ve belgesi`

---

### Task 12: E2E, tarayıcı kabulü, kapılar, yerel dev

**Files:**
- Create: `e2e/landing-esantral.e2e.ts`
- Modify/Delete: `e2e/landing-redesign.e2e.ts` (silinir, kapsamı yeni dosyada), `e2e/landing-product-stage.e2e.ts` (silinir), `e2e/lite-acquisition.e2e.ts` (hero Lite iddiaları kaldırılır), `e2e/public-site.e2e.ts`, `e2e/button-design.e2e.ts`, `e2e/cookie-consent.e2e.ts`, `e2e/demo-ocr-upload.e2e.ts`, `e2e/ruhsat-demo.e2e.ts` — yalnız `/`'da artık olmayan öğeyi doğrulayan satırlar güncellenir

**Interfaces:**
- `landing-esantral.e2e.ts` testleri:
  - 1440×900 ve 390×844: tüm çapalar mevcut, `document.documentElement.scrollWidth <= innerWidth`.
  - 375×667 ve 844×390: yatay taşma yok; H1 alt kenarı ≤ telefon görselinin üst kenarı.
  - "Sizi arayalım" (hero) → modal açılır, odak ad alanında; boş gönderim → kırmızı satır + `aria-invalid`; `page.route("/api/demo-request", 200)` ile geçerli gönderim → "Teşekkürler."; Escape kapatır, odak tetikleyiciye döner.
  - `page.route` 429 → "Çok fazla istek. Lütfen biraz bekleyin." görünür, alan değerleri korunur (Review Focus 1).
  - Kart rayı: başta "Önceki kart" `disabled`, "Sonraki kart" tıklanınca `scrollLeft` artar.
  - `colorScheme: "dark"` ve `<html class="dark">` iken `body`/sayfa kökü zemini `rgb(255, 255, 255)` (Review Focus 4).
  - Üst bant "Ücretsiz deneyin" → `/register`.
  - 390×844: site asistanı balonunun kutusu hero CTA'larıyla ve açık arama sheet'inin "Beni arayın" düğmesiyle kesişmez (sheet açıkken balon modal katmanının altında kalır).

- [ ] **Step 1:** Yeni e2e dosyasını yaz; eski spec'leri güncelle/sil. `bun run test:e2e -- e2e/landing-esantral.e2e.ts e2e/lite-acquisition.e2e.ts e2e/public-site.e2e.ts e2e/button-design.e2e.ts e2e/cookie-consent.e2e.ts` — Expected: PASS.
- [ ] **Step 2: Görsel eşlik** — scratchpad'de bir Playwright betiği `https://e-santral.com/bakimx/` ve `http://localhost:<port>/`'u 1440×900 ve 390×844'te tam sayfa yakalar; bölüm bölüm yan yana incele. Fark yalnız spec §6.1 ve §8 maddeleri olmalı. Görüntüleri PR'a ekle.
- [ ] **Step 3: Performans** — `docs/landing-performance.md` akışı (`bun run build && bun run start --port 3187` + `node scripts/measure-landing-payload.mjs /`); `/` HTML'inde H1 gizli değil, hero görseli `fetchpriority="high"`. Sonucu PR'a yaz.
- [ ] **Step 4: Kapılar** — `git fetch origin dev && git merge origin/dev`, sonra `bun test` → `bun run lint` → `bun run typecheck` → `bun run build`; hepsi yeşil, lint 0 hata.
- [ ] **Step 5: Commit** `test(#781): e-santral ana sayfa e2e`
- [ ] **Step 6: Yerel dev'e promote** (`docs/agent-workflows/issue-delivery.md` §5): `git push -u origin issue/781-esantral-landing`, `git worktree remove .worktrees/issue-781`, ana checkout'ta `git checkout dev && git merge --ff-only issue/781-esantral-landing` (olmazsa normal merge). localhost:3001 (çalışan `dev:tunnel`) hot-reload eder. Kullanıcıya kontrol edilecek akışları bildir ve onayını bekle; PR (taslak, `ci` etiketsiz, `Closes #781`) onaydan sonra.
