# Ortak Sayfa Başlığı Çerçevesi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sol menüdeki 19 sayfada breadcrumb, başlık ve standart düğmeler tek
bir `PageHeader`'dan, her sayfada aynı yerde çizilsin. Sayfa geçişinde
yükleme ekranı da aynı başlığı çizsin.

**Architecture:**
- **Rota kaydı:** sol menü tanımı (`NAV_GROUPS`) paylaşılan modüle taşınır.
  Yanına yol → başlık yapılandırması (`PAGE_HEADERS`) eklenir. Saf bir çözücü
  (`resolvePageHeader`) breadcrumb, başlık, alt satır ve düğmeleri paket/yetki
  süzgeciyle üretir.
- **Çizim:** `PageFrame` (istemci) çözücüyü `usePathname` + erişim context'iyle
  çağırır, ortak çerçeveyi ve `PageHeaderView`'ı çizer.
- **Kullanım:** hem `AppShell` (gerçek sayfa) hem `PageLoading` (yükleme
  ekranı) `PageFrame`'i kullanır.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict,
Tailwind v4 + CSS modules, shadcn/ui radix-nova, lucide-react, `bun test`.

**Spec:** `docs/superpowers/specs/2026-11-24-ortak-sayfa-basligi-design.md`.
Issue #823.

## Global Constraints

- **Çalışma yeri:** yalnız `/Users/void/www/bakimx-823`, dal
  `issue/823-page-header-frame`. Birincil checkout'a (`/Users/void/www/bakimx`)
  dokunulmaz.
- **Commit:**
  - Mesaj `feat(#823): …` / `refactor(#823): …` / `test(#823): …`.
  - Gövdenin son satırı `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **UI primitive'leri:**
  - Ham `<button>/<input>/<select>/<textarea>` yok.
  - Bağlantı düğmesi `<Button asChild><Link href>…</Link></Button>`.
  - Renk yalnız token: `text-muted-foreground`, `bg-primary`… Sabit hex/`blue-600` yok.
  - `cn()` özel metin sınıflarını siler; başlık tipografisi CSS module sınıfıyla verilir.
- **Ölçüler:**
  - Başlık 30px (<640) / 36px (≥640), 700, line-height 1.08, letter-spacing −0.035em.
  - Alt satır 17px / 19px, 500, line-height 1.35, `muted-foreground`.
  - Breadcrumb 13px, 400, `muted-foreground`.
  - Düğme yüksekliği 50px (<640) / 44px (≥640), hap (radius 999px), 17px / 500,
    yatay dolgu 28px / 22px.
  - Çerçeve en fazla 1440px, ortalı. Başlık ile içerik arası 24px (<640) / 32px (≥640).
- **Düğme varyantı:** birincil `variant="default"` (mavi), ikincil `variant="outline"`.
- **Metinler:** Türkçe metinler bu plandaki değerlerle **birebir** yazılır.
  Kayıtta yeni metin icat edilmez.
- **Yasak alanlar:**
  - Migration, server action, sunucu kapısı (`requireWritableWorkshop`) değişikliği yok.
  - `src/components/dashboard/surface.module.css` içindeki `.hero*` sınıfları
    silinmez. Paralel #818 ile çakışma riski var; yalnız kullanımdan kalkar.
- **Kapsam dışı:** teknisyen (sidebar'sız) yolları, `/settings/**` ve alt
  sayfalar (detay/yeni/düzenle, `/reports/*`, `/customers/balances`) bu planda
  değişmez. Bu yollar için `resolvePageHeader` `null` döner, bugünkü davranış sürer.
- **Testler:**
  - `mock.module` kullanma (repo-guardrails §7).
  - Test dosyaları `*.test.ts`.
- **Teslim:**
  - Her görev sonunda `bun test <ilgili dosya>` yeşil.
  - Son görevde `bun test && bun run lint && bun run typecheck && bun run build` sıfır hata.

## Review Focus

1. **Telefonda (390px) uzun başlıklar tek satırda kalmalı.** "Bakım
   Hatırlatmaları", "BakımX Siparişleri", "Yaşlandırma Raporu" iki satıra
   kırılırsa birincil düğme o sayfada aşağı kayar. Görev 6'da her kayıtlı sayfada
   başlık yüksekliği ölçülür.
2. **Paketi yetmeyen kullanıcı.** Kilitli menü öğesine (ör. Lite → Teklifler)
   basan kullanıcı yükseltme ekranını görür. Başlık ve breadcrumb görünür,
   "Yeni Teklif" görünmez. Görev 1'de çözücü testi, Görev 6'da tarayıcı.
3. **Sorgu parametreli yollar** (`/parts?tab=labor`, `/orders?status=active`):
   başlık aynı kalır, `?` başlığı düşürmez. Görev 1'de çözücü yalnız yol adıyla
   çalışır, Görev 6'da tarayıcı.
4. **`records.create` yetkisi olmayan özel ekip üyesi.** "Yeni Araç Kabul" ne
   sayfada ne yükleme ekranında görünür. Görev 1'de çözücü testi, Görev 3'te
   `teamPermissions` aktarımı.
5. **Kayıtlı sayfadan kayıtsız sayfaya geçiş** (`/orders` → `/orders/new`,
   `/customers` → `/customers/[id]`): yükleme ekranında önceki sayfanın başlığı
   kalmaz, yalnız spinner görünür. Görev 1'de çözücü `null` testi, Görev 6'da
   tarayıcı.

---

### Görev 1: Rota kaydı ve çözücü

**Files:**
- Create: `src/lib/navigation/app-nav.ts`
- Create: `src/lib/navigation/page-headers.ts`
- Create: `src/lib/navigation/page-headers.test.ts`
- Modify: `src/components/layout/app-shell.tsx` (yalnız `NavItem`, `NavGroup`,
  `NAV_GROUPS` tanımları taşınır ve import edilir; davranış değişmez)

**Interfaces:**
- Produces (`app-nav.ts`): `export type NavItem`, `export type NavGroup`,
  `export const NAV_GROUPS: NavGroup[]`. Taşınan değerler `app-shell.tsx`'teki
  tanımın birebir kopyasıdır, sıra ve etiketler değişmez.
- Produces (`page-headers.ts`):

```ts
import type { LucideIcon } from "lucide-react"
import type { UserRole } from "@prisma/client"
import type { GatedFeature } from "@/lib/plan"
import type { Permission } from "@/lib/roles"

export type PageAction = {
  label: string
  href: string
  icon: LucideIcon
  primary?: boolean
  feature?: GatedFeature
  permission?: Permission
  /** Ürün turu çapası (data-tour). */
  tourId?: string
}
export type PageHeaderConfig = {
  /** Yoksa menü etiketi. */
  title?: string
  /** Sabit açıklama satırı (yükleme ekranında da görünür). */
  description?: string
  /** Sayfa `subtitle` verir; yükleme ekranı satırın yerini boş ayırır. */
  dynamicSubtitle?: boolean
  actions?: readonly PageAction[]
  /** Başlık kökünün data-tour değeri. */
  tourId?: string
}
export type Crumb = { label: string; href?: string }
export type PageHeaderActor = { role: UserRole; teamPermissions?: readonly string[] | null }
export type ResolvedPageHeader = {
  crumbs: Crumb[]            // son halka = bu sayfa, href'siz
  title: string
  description?: string
  dynamicSubtitle: boolean
  primaryAction?: PageAction
  secondaryActions: PageAction[]
  tourId?: string
}
export const PAGE_HEADERS: Readonly<Record<string, PageHeaderConfig>>
export function hasPageHeader(pathname: string): boolean
export function resolvePageHeader(
  pathname: string,
  ctx: { enabledFeatures: readonly GatedFeature[]; actor: PageHeaderActor | null },
): ResolvedPageHeader | null
```

- [ ] **Adım 0: Bağımlılıkları kur**

Run: `cd /Users/void/www/bakimx-823 && bun install`
Expected: hata yok. `node_modules` gerçek klasör, symlink değil.

- [ ] **Adım 1: Başarısız testi yaz — `src/lib/navigation/page-headers.test.ts`**

```ts
import { describe, expect, test } from "bun:test"
import { NAV_GROUPS } from "./app-nav"
import { PAGE_HEADERS, hasPageHeader, resolvePageHeader } from "./page-headers"
import { NEW_INTAKE_HREF } from "@/lib/intake/entry-links"

const ALL = { enabledFeatures: ["quotes", "appointments", "automatedReminders", "ocrIntake", "partsInventory", "procurement", "cashbox", "analytics", "reports", "communications", "team"] as const, actor: { role: "owner" as const } }

describe("page-headers (#823)", () => {
  test("sidebar'sız /technician dışında her menü yolu kayıtlı", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]))
      .filter((h) => h !== "/technician")
    expect(hrefs.filter((h) => !hasPageHeader(h))).toEqual([])
    expect(Object.keys(PAGE_HEADERS).sort()).toEqual([...hrefs].sort())
  })
  test("üst seviye: Bölüm › Sayfa, bölüm bağlantısız", () => {
    const h = resolvePageHeader("/orders", ALL)!
    expect(h.crumbs).toEqual([{ label: "Servis" }, { label: "Araç Kabulleri" }])
    expect(h.title).toBe("Araç Kabulleri")
    expect(h.primaryAction?.href).toBe(NEW_INTAKE_HREF)
  })
  test("menü alt öğesi: üç halka, ara halka bağlantı", () => {
    expect(resolvePageHeader("/cashbox/payments", ALL)!.crumbs).toEqual([
      { label: "Depo & Finans" }, { label: "Kasa", href: "/cashbox" }, { label: "Tahsilatlar" },
    ])
  })
  test("başlık geçersiz kılma ve sabit açıklama", () => {
    const h = resolvePageHeader("/cashbox/aging", ALL)!
    expect(h.title).toBe("Yaşlandırma Raporu")
    expect(h.description).toBe("Müşteri alacaklarının vade gruplarına göre dağılımı")
  })
  test("birincil düğme ayrı, ikinciller sırasıyla", () => {
    const h = resolvePageHeader("/customers", ALL)!
    expect(h.primaryAction?.label).toBe("Yeni Müşteri")
    expect(h.secondaryActions.map((a) => a.label)).toEqual(["Bakiye Özeti"])
  })
  test("rotanın paketi yoksa (yükseltme ekranı) başlık var, düğme yok", () => {
    const h = resolvePageHeader("/quotes", { enabledFeatures: [], actor: { role: "owner" } })!
    expect(h.title).toBe("Teklifler")
    expect(h.primaryAction).toBeUndefined()
    expect(h.secondaryActions).toEqual([])
  })
  test("yetkisi olmayan ekip üyesi birincil düğmeyi görmez; kimliksiz kapı kapalı", () => {
    expect(resolvePageHeader("/orders", { ...ALL, actor: { role: "manager", teamPermissions: [] } })!.primaryAction).toBeUndefined()
    expect(resolvePageHeader("/orders", { ...ALL, actor: null })!.primaryAction).toBeUndefined()
  })
  test("kayıtsız yollar null: alt sayfalar, teknisyen, ayarlar", () => {
    for (const p of ["/orders/new", "/customers/abc", "/technician", "/settings/general", "/reports/orders"]) {
      expect(resolvePageHeader(p, ALL)).toBeNull()
    }
  })
  test("Genel Bakış tur çapaları korunur", () => {
    const h = resolvePageHeader("/dashboard", ALL)!
    expect(h.crumbs).toEqual([{ label: "Ana Panel" }, { label: "Genel Bakış" }])
    expect(h.tourId).toBe("welcome-banner")
    expect(h.primaryAction?.tourId).toBe("welcome-cta")
    expect(h.dynamicSubtitle).toBe(true)
  })
})
```

- [ ] **Adım 2: Testin düştüğünü gör**

Run: `bun test src/lib/navigation/page-headers.test.ts`
Expected: FAIL — `Cannot find module './app-nav'`.

- [ ] **Adım 3: `app-nav.ts`'i oluştur, `app-shell.tsx`'i ondan import ettir**

`NavItem`, `NavGroup`, `NAV_GROUPS` birebir taşınır; `app-shell.tsx` import
eder. `TECHNICIAN_NAV_GROUPS` ve `NAV_TOUR_ATTR` `app-shell.tsx`'te kalır.

- [ ] **Adım 4: `page-headers.ts`'i yaz**

**Çözücü kuralları:**
- **Yol eşleşmesi:** yalnız tam yol. `PAGE_HEADERS`'ta yoksa `null`.
- **Breadcrumb ve başlık:** halkalar `NAV_GROUPS`'tan türetilir.
  - Grup etiketi `href`'sizdir.
  - Alt öğede üst öğe `href`'lidir.
  - Son halka `title`'dır.
  - `title = config.title ?? menü etiketi`.
- **Rotanın paketi:** `child.feature ?? item.feature`. Bu paket
  `enabledFeatures`'ta yoksa düğmeler boş döner.
- **Düğme süzgeci:**
  - `feature` varsa açık olmalı.
  - `permission` varsa `actor && actorCan(actor, permission)`.
- **Birincil düğme:** ilk `primary: true` olan.

`PAGE_HEADERS` değerleri (metinler birebir; `+` ikonu `Plus`):

| Yol | title | description | dynamicSubtitle | actions (sırasıyla) | tourId |
|---|---|---|---|---|---|
| `/dashboard` | — | — | true | Yeni Araç Kabul → `NEW_INTAKE_HREF`, Plus, primary, `records.create`, tourId `welcome-cta` | `welcome-banner` |
| `/orders` | — | — | — | Yeni Araç Kabul → `NEW_INTAKE_HREF`, Plus, primary, `records.create` | — |
| `/customers` | — | — | true | Yeni Müşteri → `/customers/new`, Plus, primary, `records.create`; Bakiye Özeti → `/customers/balances`, Wallet | — |
| `/vehicles` | — | — | true | Yeni Araç → `/vehicles/new`, Plus, primary, `records.create` | — |
| `/quotes` | — | — | true | Yeni Teklif → `/quotes/new`, Plus, primary, `records.create` | — |
| `/appointments` | — | Servis randevularını planlayın ve yönetin | — | Yeni Randevu → `/appointments/new`, Plus, primary, `records.create` | — |
| `/calendar` | — | Randevular, teslimatlar ve bakım hatırlatmaları | — | — | — |
| `/reminders` | — | — | — | Yeni Hatırlatma → `/reminders/new`, Plus, primary, `records.create` | — |
| `/smart-capture/registration` | — | Araç ruhsat fotoğrafını yükleyin veya çekin, sistem otomatik okusun | — | — | — |
| `/parts` | — | — | — | — (sekmeye bağlı düğme içerikte kalır) | — |
| `/purchases` | — | Teknisyenlerin araç kabulüne dışarıdan aldığı parçalar | — | — | — |
| `/bakimx-orders` | — | BakımX kataloğundan istediğiniz ürünler ve talebin durumu | — | — | — |
| `/suppliers` | — | — | — | Yeni Tedarikçi → `/suppliers/new`, Plus, primary, `catalog.manage` | — |
| `/cashbox` | — | Tahsilat ve alacak takibi | — | Yeni Tahsilat → `/cashbox/payments/new`, Plus, primary, `cashbox.manage`; Yaşlandırma → `/cashbox/aging`, BarChart3 | — |
| `/cashbox/payments` | — | — | true | Yeni Tahsilat → `/cashbox/payments/new`, Plus, primary, `cashbox.manage` | — |
| `/cashbox/aging` | Yaşlandırma Raporu | Müşteri alacaklarının vade gruplarına göre dağılımı | — | — | — |
| `/analytics` | — | Atölyenizin operasyonel sağlığını ve performans metriklerini izleyin. | — | — | — |
| `/reports` | — | — | — | — | — |
| `/communications` | — | Müşterilerinize ve hesabınıza gönderilen SMS, WhatsApp ve e-posta kayıtları | — | — | — |

- [ ] **Adım 5: Testi geçir**

Run: `bun test src/lib/navigation/page-headers.test.ts && bun run typecheck`
Expected: 9 pass, typecheck temiz.

- [ ] **Adım 6: Commit** — `feat(#823): sayfa başlığı rota kaydı ve çözücü`

---

### Görev 2: `PageHeaderView`, `PageFrame` ve breadcrumb primitive'i

**Files:**
- Create (shadcn CLI): `src/components/ui/breadcrumb.tsx`
- Create: `src/components/layout/page-header.tsx`
- Create: `src/components/layout/page-header.module.css`
- Create: `src/components/layout/page-header.test.ts`

**Interfaces:**
- Consumes: `ResolvedPageHeader`, `PageHeaderActor`, `resolvePageHeader`
  (Görev 1).
- Produces (`page-header.tsx`, `"use client"`):

```ts
export type PageHeaderAccess = { enabledFeatures: readonly GatedFeature[]; actor: PageHeaderActor | null }
export const PageHeaderAccessContext: React.Context<PageHeaderAccess> // varsayılan { enabledFeatures: [], actor: null }
export function PageHeaderView(props: { header: ResolvedPageHeader; subtitle?: React.ReactNode }): React.JSX.Element
/** Kayıtlı yolda çerçeve + başlık + children; kayıtsız yolda yalnız children. */
export function PageFrame(props: { subtitle?: React.ReactNode; children: React.ReactNode }): React.JSX.Element
```

- [ ] **Adım 1: Breadcrumb bileşenini ekle**

Run: `bunx shadcn@latest add breadcrumb`
Expected: `src/components/ui/breadcrumb.tsx` oluşur, radix-nova stili.
`git diff --stat` başka dosyaya dokunmamalı. `globals.css` değiştiyse geri al.

- [ ] **Adım 2: Başarısız testi yaz — `page-header.test.ts`**

`renderToStaticMarkup(createElement(PageHeaderView, …))` ile
(`highlight-card.test.ts` kalıbı):
- `crumbs` son halkası `aria-current="page"` taşır. Grup etiketi (`Servis`)
  `<a` içinde değildir. Alt öğe halkası (`Kasa`) `href="/cashbox"` bağlantısıdır.
- `dynamicSubtitle: true` ve `subtitle` yokken çıktıda
  `data-slot="page-subtitle"` ve `aria-hidden="true"` vardır (boş ayrılmış satır).
  `subtitle: "3 kayıt"` verilince metin görünür, `aria-hidden` yoktur.
- `description` verildiğinde `data-slot="page-subtitle"` içinde açıklama metni
  bulunur.
- Hem `dynamicSubtitle: false` hem `description` yokken `page-subtitle` hiç
  çıkmaz.
- Birincil düğme etiketi HTML'de ikincilden önce gelir:
  `html.indexOf("Yeni Müşteri") < html.indexOf("Bakiye Özeti")`.
- `tourId: "welcome-banner"` ve birincil `tourId: "welcome-cta"` →
  `data-tour="welcome-banner"` ve `data-tour="welcome-cta"`.
- Başlık `<h1` içindedir.

- [ ] **Adım 3: Testin düştüğünü gör**

Run: `bun test src/components/layout/page-header.test.ts`
Expected: FAIL — modül yok.

- [ ] **Adım 4: Bileşeni ve CSS'i yaz**

**DOM sırası:**
- kök (`data-slot="page-header"`, `data-tour`)
  → Breadcrumb
  → satır [ `h1` başlık , düğmeler (birincil önce, sonra ikinciller) ]
  → `p[data-slot=page-subtitle]`.
- Alt satır içeriği: `subtitle ?? description`. İkisi de yokken ve
  `dynamicSubtitle` ise `" "` + `aria-hidden`.

**<640px:**
- Satır `flex-direction: column`, aralık 16px.
- Düğme kabı `flex-direction: column`. Birincil tam genişlik. İkinciller
  altında, `flex-wrap`, her biri `flex: 1`.

**≥640px:**
- Satır `row`, `align-items: center`, `justify-content: space-between`.
- Düğme kabı `flex-direction: row-reverse`, aralık 8px (birincil en sağda).

**Diğer:**
- Ölçüler Global Constraints'teki değerler.
- `PageFrame` çerçevesi: `max-width: 1440px; margin-inline: auto; width: 100%;
  display: flex; flex-direction: column; gap: 24px` (≥640px'te 32px).
- `PageFrame` `usePathname()` + `useContext(PageHeaderAccessContext)` ile
  çözer; `null` ise `<>{children}</>`.

- [ ] **Adım 5: Testi geçir**

Run: `bun test src/components/layout/page-header.test.ts src/lib/ui-contract.test.ts src/lib/theme-tokens.test.ts && bun run typecheck`
Expected: PASS.

- [ ] **Adım 6: Commit** — `feat(#823): PageHeader, PageFrame ve breadcrumb`

---

### Görev 3: Kabuğu bağla — `AppShell`, yükleme ekranı, üst bar

**Files:**
- Modify: `src/app/(app)/layout.tsx` (`userIdentity`'ye `teamPermissions: user.teamPermissions`)
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/shared/page-loading.tsx`
- Create: `src/app/(app)/cashbox/loading.tsx`

**Interfaces:**
- Consumes: `PageFrame`, `PageHeaderAccessContext` (Görev 2), `hasPageHeader`
  (Görev 1).
- Produces:
  - `AppShell` yeni prop: `subtitle?: React.ReactNode`.
  - `pageActions` prop'u **kalkar** (yalnız `vehicles` ve `appointments`
    kullanıyordu; Görev 4 onları temizler).
  - `pageTitle` kayıtsız yollar ve `FeaturePaywall` için kalır.

- [ ] **Adım 1: Kabuk değişikliklerini yap**

- **`AppShellChrome`:** çocukları
  `<PageHeaderAccessContext.Provider value={{ enabledFeatures, actor: userIdentity ?? null }}>`
  ile sarar. `useMemo` ile sabitlenir.
- **`AppShell`:**
  - Settings dalı aynen kalır.
  - `hasPageHeader(pathname)` ise `<PageFrame subtitle={subtitle}>` içinde
    children'ı çizer. `wide`/`constrained` iç sarmal olarak çerçevenin içinde
    kalır. Masaüstü `desktopTitle` h1'i çizilmez.
  - Değilse bugünkü yol.
- **Kaldırılanlar:**
  - `CONTENT_H1_PATHS`, `OWN_TITLE_MENU_PATHS` ve `MENU_PATHS` kümeleri.
  - `desktopTitleMode` şuna iner:
    `BAR_TITLE_ONLY_PATHS.has(p) ? "visible" : "sr-only"`.
- **`AppHeader`:**
  - `contentOwnsTitle = hasPageHeader(pathname)`.
  - `showMobileTitle` kayıtlı yolda `false`. Ortada logo görünür.
  - `MOBILE_CONTENT_HEADING_PATHS`'ten kayıtlı yollar çıkar; kalan:
    `/orders/new`, `/customers/new`, `/vehicles/new`, `/technician`,
    `/appointments/new`.
  - `pageActions` render'ı ve `PageHeaderState.pageActions` silinir.
- **`PageLoading`:** `<PageFrame>` içinde bugünkü spinner bloğunu çizer.
- **`cashbox/loading.tsx`:** `(app)/loading.tsx` ile birebir aynı.

- [ ] **Adım 2: Kapıları koş**

Run: `bun run typecheck`
Expected: yalnız `vehicles/page.tsx` ve `appointments/page.tsx`'te
`pageActions` hatası. Görev 4'te kalkar. Başka hata yok.

- [ ] **Adım 3: Yükleme-anı varsayımını tarayıcıda doğrula (spec §Yükleme ekranı)**

1. `src/app/(app)/customers/page.tsx` başına **geçici olarak**
   `await new Promise((r) => setTimeout(r, 3000))` ekle (commit edilmez).
2. Çalıştır: `bunx next dev --port 3223`.
3. Aç: `http://localhost:3223/api/auth/dev-login?email=admin@bakimx.com&redirect=/orders`.
4. Sol menüden "Müşteriler"e tıkla. Spinner dönerken başlık alanının durumunu
   kaydet.

Expected: spinner dönerken breadcrumb `Servis › Müşteriler`, başlık
"Müşteriler" ve "Yeni Müşteri" görünür.

- **Önceki sayfanın başlığı görünürse ya da başlık hiç yoksa:** DUR. Bulguyu
  raporla; spec'teki alternatif yola (`useLinkStatus` / hedef yol) karar
  verilmeden devam etme.
- **Sonrasında:** geçici gecikmeyi geri al (`git checkout -- 'src/app/(app)/customers/page.tsx'`)
  ve sunucuyu durdur.

- [ ] **Adım 4: Commit** — `feat(#823): kabuk ortak başlık çerçevesini çizer, yükleme ekranı dahil`

---

### Görev 4: Servis sayfalarını taşı

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`,
  `src/app/(app)/orders/page.tsx`, `src/app/(app)/customers/page.tsx`,
  `src/app/(app)/vehicles/page.tsx`, `src/app/(app)/quotes/page.tsx`,
  `src/app/(app)/appointments/page.tsx`, `src/app/(app)/calendar/page.tsx`,
  `src/app/(app)/reminders/page.tsx`,
  `src/app/(app)/smart-capture/registration/page.tsx`
- Modify: `src/components/reminders/reminder-list.tsx`
- Modify (test): `src/lib/ui-contract.test.ts`

**Interfaces:**
- Consumes: `AppShell` `subtitle` prop (Görev 3), `PAGE_HEADERS` (Görev 1).

- [ ] **Adım 1: Kaynak kapısını yaz — `ui-contract.test.ts`**

Yeni test `"kayıtlı menü sayfaları başlığı PageFrame'e bırakır (#823)"`:
- `Object.keys(PAGE_HEADERS)` üzerinden dolaşır.
- Her yol için `src/app/(app)${href}/page.tsx`'i okur.
- Şunların **hiçbirini** içermediğini doğrular: `surface.hero`, `<h1`,
  `pageActions=`, `pageTitle=`.
- Hata mesajı yolu adıyla listeler.

- [ ] **Adım 2: Kapının düştüğünü gör**

Run: `bun test src/lib/ui-contract.test.ts`
Expected: FAIL — 19 yolun hepsi listelenir.

- [ ] **Adım 3: Sayfaları taşı**

Kural:
- `pageTitle` / `pageActions` kalkar.
- İçerikteki başlık/sayı/"Yeni …" satırı kalkar.
- Sayfa yalnız aşağıdaki `subtitle`'ı verir.
- Paywall dalları (`getFeaturePaywall`) dokunulmaz.

| Sayfa | `subtitle` | İçerikten kalkan | İçerikte kalan |
|---|---|---|---|
| dashboard | `` `${workshop?.name ?? "Genel Bakış"} · ${tarih}${greetingName ? ` · Hoş geldiniz, ${greetingName}` : ""}` `` (tarih bugünkü `toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })`) | `surface.hero` section'ı (h1 + CTA) | `surface.root` ve altındaki her şey; `data-tour="first-order"` |
| orders | — | `surface.hero` section'ı | `OrderList` ve filtre formu |
| customers | `` `${rows.length} müşteri kayıtlı` `` | sayı + "Bakiye Özeti" + "Yeni Müşteri" satırı | Bilgi şeridi ve liste |
| vehicles | `` `${vehicles.length} araç kayıtlı` `` | boş `hidden sm:flex` div, sayı, "Yeni Araç" | Devre dışı "Plaka Tara" düğmesi + Tooltip, sağa yaslı kendi satırında |
| quotes | `` `${quotes.length} teklif` `` | sayı + iki "Yeni Teklif" düğmesi | Arama formu ve liste |
| appointments | — | açıklama + "Yeni Randevu" satırı | Arama formu ve liste |
| calendar | — | açıklama satırı | `CalendarView` |
| reminders | — | — | `ReminderList`. İçinde: CardHeader'daki "Yeni Hatırlatma" düğmesi kalkar; "Hatırlatmalar (n)" başlığı ve boş-durum bağlantısı kalır |
| smart-capture/registration | — | "Panel / Ruhsat Okuma" sahte breadcrumb'ı + ikonlu h2 + açıklama | `SmartCaptureRegistration` |

- [ ] **Adım 4: Testleri koş**

Run: `bun test src/lib/ui-contract.test.ts src/lib/navigation src/components/layout && bun run typecheck`
Expected:
- Kapı yalnız Görev 5'in 10 yolu için düşer: `/parts`, `/purchases`,
  `/bakimx-orders`, `/suppliers`, `/cashbox`, `/cashbox/payments`,
  `/cashbox/aging`, `/analytics`, `/reports`, `/communications`.
- typecheck temiz.

- [ ] **Adım 5: Commit** — `refactor(#823): Servis sayfaları ortak başlık çerçevesine geçti`

---

### Görev 5: Depo & Finans, Analiz ve İletişim sayfalarını taşı

**Files:**
- Modify: `src/app/(app)/parts/page.tsx` (iki `AppShell` dalı),
  `src/app/(app)/purchases/page.tsx`, `src/app/(app)/bakimx-orders/page.tsx`,
  `src/app/(app)/suppliers/page.tsx`, `src/app/(app)/cashbox/page.tsx`,
  `src/app/(app)/cashbox/payments/page.tsx`,
  `src/app/(app)/cashbox/aging/page.tsx`, `src/app/(app)/analytics/page.tsx`,
  `src/app/(app)/reports/page.tsx`, `src/app/(app)/communications/page.tsx`
- Modify: `src/components/parts/parts-list.tsx`,
  `src/components/labor/labor-list.tsx`,
  `src/components/suppliers/suppliers-list.tsx`,
  `src/components/reports/reports-layout.tsx`

**Interfaces:**
- Consumes: Görev 3–4 ile aynı.

- [ ] **Adım 1: Sayfaları taşı**

| Sayfa | `subtitle` | Kalkan | Kalan |
|---|---|---|---|
| parts + `parts-list` + `labor-list` | — | İki listedeki ikonlu `h2` ("Stok / Parçalar") | "Yeni Parça" / "Yeni İşçilik" düğmesi `PartsTabsNav` ile aynı satırda sağa yaslı; <640'ta sekmelerin altında tam genişlik |
| purchases | — | açıklama `p` | `wide`, `InlineFeatureUpsell`, filtre formu |
| bakimx-orders | — | açıklama `p` | `wide`, upsell, liste |
| suppliers + `suppliers-list` | — | `h2` "Tedarikçiler" + "Yeni Tedarikçi" satırı | KPI'lar ve liste |
| cashbox | — | açıklama + "Yaşlandırma" + "Yeni Tahsilat" satırı | Bilgi şeridi, KPI'lar |
| cashbox/payments | `` `${total} kayıt bulundu` `` | sayı + "Yeni Tahsilat" | CSV + `PrintButton`, filtre formunun üstünde sağa yaslı kendi satırında |
| cashbox/aging | — | açıklama `p` | KPI ızgarası ve kartlar |
| analytics | — | açıklama `p` | Bölümler |
| reports + `reports-layout` | — | `ReportsLayout`'taki ikonlu `h2` "Raporlar" **yalnız `pathname === "/reports"` iken** gizlenir (alt rapor sayfaları kapsam dışı, onlarda kalır) | Rapor sekmeleri |
| communications | — | açıklama `div` | `CommunicationLogList`. "İş yeri bilgisi bulunamadı" dalındaki `<AppShell>` aynen kalır |

- [ ] **Adım 2: Kapıyı ve ilgili testleri koş**

Run: `bun test src/lib/ui-contract.test.ts src/lib/navigation src/components/layout && bun run typecheck`
Expected: PASS. Kapı 19 yolun hepsinde yeşil.

- [ ] **Adım 3: Commit** — `refactor(#823): Depo, Finans, Analiz ve İletişim sayfaları ortak başlık çerçevesinde`

---

### Görev 6: Doğrulama, belge ve tam kapı

**Files:**
- Modify: `AGENTS.md` (UI Component Rules altına tek madde)

- [ ] **Adım 1: Kuralı belgele**

`AGENTS.md` → "UI Component Rules" altına şu madde eklenir:

> **Menü sayfalarının başlığı `PageFrame`'den gelir (#823).** Breadcrumb,
> başlık ve standart düğmeler `src/lib/navigation/page-headers.ts` kaydından
> çizilir (yükleme ekranı dahil). Kayıtlı bir sayfa kendi `h1`/hero'sunu,
> `pageTitle`/`pageActions`'ını vermez; yalnız `subtitle` verir. Yeni menü
> sayfası = kayda bir satır. Kapı: `src/lib/ui-contract.test.ts`.

- [ ] **Adım 2: Tam kapı**

Run: `bun test && bun run lint && bun run typecheck && bun run build`
Expected: dördü de sıfır hata. `bun run build` `SESSION_SECRET` ister,
`.env.local`'den gelir.

- [ ] **Adım 3: Tarayıcı QA (390 ve 1440)**

**Hazırlık:**
- `bunx next dev --port 3223`.
- `admin@bakimx.com` ile dev-login.
- Her ölçüm `document.querySelector('[data-slot=page-header]')` ve birincil
  düğme `getBoundingClientRect()` ile yapılır.

**Kontroller:**
1. **Konum:** `/dashboard` → `/orders` → `/customers` → `/cashbox` →
   `/cashbox/payments` gezinmesinde breadcrumb'ın, `h1`'in ve birincil
   düğmenin `top`/`right` değerleri sayfalar arasında aynı (±1px).
   Hem 390 hem 1440'ta.
2. **Uzun başlıklar (Review Focus 1):** 390'da 19 kayıtlı yolun hepsinde
   `h1.getBoundingClientRect().height`, tek satır yüksekliğine eşit
   (30px × 1.08 ≈ 32.4px).
3. **Geçişte başlık (Görev 3 Adım 3 tekrarı):** `/orders` → `/cashbox/payments`
   geçişinde de başlık spinner sırasında görünür. Geçici gecikmeyle bakılır,
   sonra geri alınır.
4. **Kayıtsız sayfaya geçiş (Review Focus 5):** `/orders` → bir iş emri
   detayı ve `/orders` → `/orders/new` geçişlerinde yükleme ekranında başlık
   yok, yalnız spinner. Detay sayfasının kendi başlığı bugünkü gibi.
5. **Sorgu parametresi (Review Focus 3):** `/parts?tab=labor` ve
   `/orders?status=active` başlığı korur. Parça sekmesinde "Yeni İşçilik"
   içerikte.
6. **Telefon üst barı:** 390'da kayıtlı yollarda üst barda başlık yok, ortada
   logo var. Araçlar ve Randevular'da "+" ikonu yok.
7. **Paket kilidi (Review Focus 2):** yerel DB'de Lite/Starter planlı bir
   atölye varsa onunla `/quotes`: başlık "Teklifler", "Yeni Teklif" yok.
   Yoksa bu adım atlandı diye raporlanır, test kapsamı Görev 1.
8. **Konsol:** React key / hydration uyarısı yok.

Sunucuyu durdur.

- [ ] **Adım 4: Commit** — `docs(#823): menü sayfası başlık kuralı AGENTS.md'de`

Sonrası teslimat akışıdır (`docs/agent-workflows/issue-delivery.md`):
`origin/dev` ile birleştir, kapıları yeniden koş, PR (`Closes #823`), yeşil
`quality`, squash-merge, birincil checkout'u fast-forward et.
