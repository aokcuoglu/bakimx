# BakımX Site Asistanı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing/public sayfalara, mevcut demo/destek lead altyapısına bağlanan, buton/form tabanlı bir "satış asistanı" widget'ı (Tekmetric-Gauge benzeri) eklemek.

**Architecture:** Kök `layout.tsx`'e tek bir client component (`SiteAssistant`) mount edilir; `usePathname()` ile public allowlist dışındaki yollarda `null` döner. Sağ-alt FAB + açılır panel; panel içinde `menu → demo/support/faq → success` görünüm state makinesi. Demo/destek formları **mevcut** `POST /api/demo-request` ve `POST /api/support-request` endpoint'lerine yazar. Yeni DB modeli / migration / API yoktur.

**Tech Stack:** Next.js (App Router), React client component, TypeScript (strict), shadcn `ui/*` (Base UI), lucide-react, `bun test` (yalnız `src/lib` saf mantık için — component test altyapısı yok).

## Global Constraints

- Tüm etkileşimli kontroller shadcn `ui/*` primitifleri (`Button`, `Input`, `Label`, `Textarea`, `Select`) — native `<select>`/hand-rolled kontrol YOK. Kap/konumlandırma div'leri serbest. [[shadcn-components-only-no-custom]]
- Form kontrolleri web'de `h-9` (ui varsayılanları zaten sağlar); override etme. Birincil CTA `size="lg"`. [[component-height-web-h9]]
- Renk: blue/navy marka; FAB & panel başlığı `bg-primary` (`#2563EB`). Yeşil yalnız WhatsApp bağlamında (bu widget'ta yok).
- Yükleme durumu: inline `Loader2 animate-spin` (mevcut form deseni) — bu widget küçük olduğundan mevcut `DemoRequestSection` desenini birebir izle.
- TypeScript strict; `any` yok.
- Yeni npm/bun bağımlılığı EKLENMEZ.
- Şema/migration/API'ye DOKUNULMAZ.
- Tenant izolasyonu: widget kimlik-öncesi (public); tenant verisine erişmez, yalnız mevcut public POST endpoint'lerine yazar.
- Yanıt sözleşmesi (her iki endpoint): `{ success: boolean, errors?: Record<string,string>, message?: string }`. Alan hataları ilgili alan altında, `_general` panel üstünde gösterilir. 429 → `_general`.
- Dil: tüm kullanıcı-yüzü metin Türkçe.
- **Branch:** Çalışma başında `git checkout -b feat/site-assistant`. Çalışma ağacında ilgisiz WIP dosyaları (`customer-search-or-create.tsx`, `vehicle-detail.tsx`) var — **hiçbir commit'e dahil etme**; her commit'te dosya yollarını AÇIKÇA `git add` ile ver.

---

## Setup (görev öncesi)

- [ ] Branch oluştur:

```bash
cd /Users/void/www/bakimx
git checkout -b feat/site-assistant
```

(WIP dosyaları takip edilmeden çalışma ağacında kalır; sorun değil — commit'lerde açık yol veriyoruz.)

---

## File Structure

**Yeni:**
- `src/lib/faq-data.ts` — SSS içeriği (tek kaynak)
- `src/lib/faq-data.test.ts` — şekil testi
- `src/lib/site-assistant-visibility.ts` — `isPublicAssistantPath(pathname)` saf fonksiyon
- `src/lib/site-assistant-visibility.test.ts` — gate testi
- `src/components/site-assistant/site-assistant.tsx` — üst bileşen (gate + state + tipler)
- `src/components/site-assistant/assistant-launcher.tsx` — FAB
- `src/components/site-assistant/assistant-panel.tsx` — panel kabı + Esc + görünüm switch
- `src/components/site-assistant/views/menu-view.tsx`
- `src/components/site-assistant/views/demo-form-view.tsx`
- `src/components/site-assistant/views/support-form-view.tsx`
- `src/components/site-assistant/views/faq-view.tsx`
- `src/components/site-assistant/views/success-view.tsx`

**Değiştirilen:**
- `src/components/sections/FAQSection.tsx` — `faqs` → `@/lib/faq-data`'dan import
- `src/app/layout.tsx` — `<SiteAssistant />` mount

---

### Task 1: FAQ verisini tek kaynağa çıkar

`FAQSection.tsx` içindeki `faqs` dizisini `src/lib/faq-data.ts`'e taşı; hem FAQSection hem (sonraki) faq-view aynı kaynağı kullansın. Görsel/davranış aynı kalır.

**Files:**
- Create: `src/lib/faq-data.ts`
- Create: `src/lib/faq-data.test.ts`
- Modify: `src/components/sections/FAQSection.tsx:12-63` (yerel `faqs` dizisini kaldır, import et)

**Interfaces:**
- Produces: `export interface FaqItem { question: string; answer: string }` ve `export const FAQ_ITEMS: FaqItem[]`

- [ ] **Step 1: Test yaz (failing)**

`src/lib/faq-data.test.ts`:

```ts
import { expect, test } from "bun:test";
import { FAQ_ITEMS } from "./faq-data";

test("FAQ_ITEMS doludur ve her öğe soru+cevap içerir", () => {
  expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);
  for (const item of FAQ_ITEMS) {
    expect(item.question.trim().length).toBeGreaterThan(0);
    expect(item.answer.trim().length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Testi çalıştır, fail görsün**

Run: `bun test src/lib/faq-data.test.ts`
Expected: FAIL — `Cannot find module './faq-data'`

- [ ] **Step 3: `faq-data.ts` oluştur**

`src/lib/faq-data.ts` — `FAQSection.tsx`'teki 10 öğeyi birebir taşı:

```ts
export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "BakimX mobilde çalışır mı?",
    answer:
      "Evet, BakimX tamamen mobil öncelikli tasarlanmıştır. Telefonunuzdan araç kabul edebilir, fotoğraf çekebilir, iş emri ve teklif oluşturabilirsiniz. Masaüstü cihazlardan da erişim mümkündür.",
  },
  {
    question: "Ruhsat okuma nasıl çalışır? Parça fiyatı veriyor musunuz?",
    answer:
      "Ruhsatın fotoğrafını yükleyin; plaka, marka/model, VIN, model yılı ve sahibi gibi bilgiler otomatik doldurulsun, siz onaylamadan önce kontrol edin. Aracın VIN'iyle eşleşen, ona uygun katalog parçalarını görürsünüz. Parça fiyatlarını biz belirlemeyiz; fiyatlandırma tamamen sizin kendi kataloğunuzdan gelir.",
  },
  {
    question: "Hangi modüller bugün hazır?",
    answer:
      "İş emri, teklif, randevu, takvim, stok/parça, tedarikçi, kasa (tahsilat ve yaşlandırma), müşteri & araç yönetimi, bakım hatırlatmaları, raporlar ve iletişim modülleri bugün kullanıma hazırdır. AI servis danışmanı Premium pakette yer alır.",
  },
  {
    question: "Stok, tedarikçi ve tahsilat takibi var mı?",
    answer:
      "Evet. Parça stoğunuzu kritik eşiklerle takip eder, tedarikçilerinizi yönetir, tahsilatları kasada toplar ve yaşlandırma (alacak) raporu alırsınız.",
  },
  {
    question: "Müşteriye WhatsApp ile çıktı gönderilebilir mi?",
    answer:
      "Evet. Teklif ve iş emri özetini WhatsApp veya link ile doğrudan müşteriye gönderebilir, tarayıcıdan yazdırabilirsiniz. Markalı PDF dışa aktarma yakında ekleniyor.",
  },
  {
    question: "Birden fazla kullanıcı ekleyebilir miyim?",
    answer:
      "Evet. Ekibinizi davet edip rol verebilirsiniz; teknisyen, servis danışmanı ve yönetici farklı yetkilerle çalışır.",
  },
  {
    question: "Verilerim güvende mi?",
    answer:
      "Her servis yalnızca kendi verisini görür ve erişim rol bazlıdır (sahip / yönetici / personel). Platform KVKK uyumlu olacak şekilde geliştiriliyor.",
  },
  {
    question: "Küçük oto tamircileri için uygun mu?",
    answer:
      "Kesinlikle. BakimX, küçük ve orta ölçekli oto tamir atölyeleri için tasarlanmıştır. Tek kişilik kullanıma uygundur ve kurulum için teknik bilgi gerektirmez.",
  },
  {
    question: "Nasıl başlarım? Ücretsiz deneme var mı?",
    answer:
      "\"Ücretsiz Dene\" diyerek iş yeri bilgilerinizle hesabınızı oluşturur ve kartınızı doğrularsınız. Doğrulama sırasında kartınızdan yalnızca 1 TL'lik provizyon alınır ve anında iade edilir; kart doğrulamasının ardından hesabınız anında açılır ve 7 günlük ücretsiz deneme süreniz başlar. Deneme süresince ücret ödemezsiniz; beğenirseniz size uygun pakete geçersiniz.",
  },
  {
    question: "Kurulum için bilgisayar gerekir mi?",
    answer:
      "Hayır. BakimX tarayıcı tabanlı bir platformdur. Telefonunuzun internet tarayıcısından doğrudan erişebilirsiniz. Herhangi bir kurulum veya indirme gerekmez.",
  },
];
```

- [ ] **Step 4: `FAQSection.tsx`'i import'a çevir**

`src/components/sections/FAQSection.tsx` içinde yerel `const faqs = [...]` bloğunu (satır ~12-63) SİL ve üste import ekle:

```tsx
import { FAQ_ITEMS } from "@/lib/faq-data";
```

Ardından `.map` çağrısında `faqs.map(...)` → `FAQ_ITEMS.map(...)` olarak değiştir (satır ~85). Başka değişiklik yok.

- [ ] **Step 5: Testi ve typecheck'i çalıştır**

Run: `bun test src/lib/faq-data.test.ts && bun run typecheck`
Expected: test PASS; typecheck hatasız.

- [ ] **Step 6: Commit**

```bash
git add src/lib/faq-data.ts src/lib/faq-data.test.ts src/components/sections/FAQSection.tsx
git commit -m "refactor(faq): SSS içeriğini faq-data.ts tek kaynağına çıkar"
```

---

### Task 2: Görünürlük gate (saf fonksiyon + TDD)

Widget'ın hangi path'lerde görüneceğini belirleyen saf fonksiyon. Tam test kapsamı — gate ana risk alanı.

**Files:**
- Create: `src/lib/site-assistant-visibility.ts`
- Create: `src/lib/site-assistant-visibility.test.ts`

**Interfaces:**
- Produces: `export function isPublicAssistantPath(pathname: string): boolean`

- [ ] **Step 1: Test yaz (failing)**

`src/lib/site-assistant-visibility.test.ts`:

```ts
import { expect, test } from "bun:test";
import { isPublicAssistantPath } from "./site-assistant-visibility";

test("public path'lerde true döner", () => {
  for (const p of ["/", "/fiyatlar", "/demo", "/satin-al", "/terms", "/privacy"]) {
    expect(isPublicAssistantPath(p)).toBe(true);
  }
});

test("public path'in alt yollarında true döner", () => {
  expect(isPublicAssistantPath("/fiyatlar/detay")).toBe(true);
  expect(isPublicAssistantPath("/privacy/kvkk")).toBe(true);
});

test("uygulama/admin/auth yollarında false döner", () => {
  for (const p of ["/dashboard", "/admin", "/admin/leads", "/login", "/register", "/checkout", "/payment", "/orders/123", "/p/abc", "/s/xyz"]) {
    expect(isPublicAssistantPath(p)).toBe(false);
  }
});

test("benzer ama farklı prefix'lerde false döner (kelime sınırı)", () => {
  expect(isPublicAssistantPath("/demoxyz")).toBe(false);
  expect(isPublicAssistantPath("/termsofservice")).toBe(false);
});
```

- [ ] **Step 2: Testi çalıştır, fail görsün**

Run: `bun test src/lib/site-assistant-visibility.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Fonksiyonu yaz**

`src/lib/site-assistant-visibility.ts`:

```ts
/**
 * Site asistanı yalnızca public/pazarlama sayfalarında görünür.
 * (app)/(auth)/admin ve satın-alma-sonrası yollarında render EDİLMEZ.
 */
const PUBLIC_PREFIXES = ["/fiyatlar", "/demo", "/satin-al", "/terms", "/privacy"] as const;

export function isPublicAssistantPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
```

- [ ] **Step 4: Testi çalıştır, geçsin**

Run: `bun test src/lib/site-assistant-visibility.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-assistant-visibility.ts src/lib/site-assistant-visibility.test.ts
git commit -m "feat(site-assistant): public path görünürlük gate + testleri"
```

---

### Task 3: Widget kabuğu (launcher + panel shell) ve mount

FAB + boş panel + kök layout mount. Görünümler henüz placeholder; bu görev "FAB açılır/kapanır, gate doğru çalışır"ı doğrular.

**Files:**
- Create: `src/components/site-assistant/site-assistant.tsx`
- Create: `src/components/site-assistant/assistant-launcher.tsx`
- Create: `src/components/site-assistant/assistant-panel.tsx`
- Modify: `src/app/layout.tsx` (mount)

**Interfaces:**
- Consumes: `isPublicAssistantPath` (Task 2)
- Produces:
  - `export type AssistantView = "menu" | "demo" | "support" | "faq" | "success"`
  - `export type SuccessContext = "demo" | "support"`
  - `export function SiteAssistant(): JSX.Element | null`
  - `AssistantLauncher` props: `{ open: boolean; onClick: () => void }`
  - `AssistantPanel` props: `{ view: AssistantView; successContext: SuccessContext; onNavigate: (view: AssistantView) => void; onSuccess: (context: SuccessContext) => void; onClose: () => void }`

- [ ] **Step 1: `site-assistant.tsx` (üst bileşen + tipler)**

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isPublicAssistantPath } from "@/lib/site-assistant-visibility";
import { AssistantLauncher } from "./assistant-launcher";
import { AssistantPanel } from "./assistant-panel";

export type AssistantView = "menu" | "demo" | "support" | "faq" | "success";
export type SuccessContext = "demo" | "support";

const OPEN_KEY = "bakimx.assistant.open";

export function SiteAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AssistantView>("menu");
  const [successContext, setSuccessContext] = useState<SuccessContext>("demo");
  const [hydrated, setHydrated] = useState(false);

  // Açık/kapalı durumunu oturumlar arası koru (auto-açılış YOK; ilk ziyaret kapalı).
  useEffect(() => {
    setHydrated(true);
    try {
      if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
    } catch {
      /* localStorage erişilemezse yok say */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* yok say */
    }
  }, [open, hydrated]);

  if (!isPublicAssistantPath(pathname)) return null;

  return (
    <>
      <AssistantLauncher
        open={open}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            setView("menu");
            setOpen(true);
          }
        }}
      />
      {open && (
        <AssistantPanel
          view={view}
          successContext={successContext}
          onNavigate={setView}
          onSuccess={(context) => {
            setSuccessContext(context);
            setView("success");
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: `assistant-launcher.tsx` (FAB)**

shadcn `Button`, marka mavisi, sağ-alt sabit. Native buton değil.

```tsx
"use client";

import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssistantLauncherProps {
  open: boolean;
  onClick: () => void;
}

export function AssistantLauncher({ open, onClick }: AssistantLauncherProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={open ? "Asistanı kapat" : "BakımX Asistanı'nı aç"}
      aria-expanded={open}
      className={cn(
        "fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full p-0 shadow-lg shadow-primary/25",
        "[&_svg:not([class*='size-'])]:size-6 sm:bottom-6 sm:right-6",
      )}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {open ? <X /> : <MessageCircle />}
    </Button>
  );
}
```

- [ ] **Step 3: `assistant-panel.tsx` (kap + Esc + görünüm switch, geçici placeholder gövde)**

Bu görevde görünümler henüz yok; gövdeye geçici bir metin koy. Task 4-8 gerçek görünümleri bağlayacak.

```tsx
"use client";

import { useEffect } from "react";
import { X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantView, SuccessContext } from "./site-assistant";

interface AssistantPanelProps {
  view: AssistantView;
  successContext: SuccessContext;
  onNavigate: (view: AssistantView) => void;
  onSuccess: (context: SuccessContext) => void;
  onClose: () => void;
}

export function AssistantPanel({ view, onClose }: AssistantPanelProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="BakımX Asistanı"
      aria-modal="false"
      className={
        "fixed z-40 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl " +
        "bottom-20 left-4 right-4 max-h-[70vh] " +
        "sm:bottom-24 sm:left-auto sm:right-6 sm:w-[380px] sm:max-h-[560px]"
      }
    >
      <header className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Wrench className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">BakımX Asistanı</p>
          <p className="text-xs leading-tight text-primary-foreground/80">
            Sorularınız için buradayız
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Kapat"
          className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* GEÇİCİ — Task 4-8 gerçek görünümleri bağlayacak */}
        <div className="p-4 text-sm text-muted-foreground">Görünüm: {view}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Kök layout'a mount et**

`src/app/layout.tsx` — import ekle ve `<Toaster />` yanına yerleştir:

```tsx
import { SiteAssistant } from "@/components/site-assistant/site-assistant";
```

`<body>` içinde, `TooltipProvider` çocukları arasında:

```tsx
        <TooltipProvider>
          {children}
          <Toaster />
          <SiteAssistant />
        </TooltipProvider>
```

- [ ] **Step 5: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hatasız. (`successContext`/`onNavigate`/`onSuccess` prop'ları henüz kullanılmadığı için lint "unused" derse, `AssistantPanel` imza yorumuna `// eslint-disable-next-line` EKLEME — bunun yerine prop'ları destructure etmeden bırak; imza tipi korunur, kullanılmayan uyarısı çıkmaz çünkü destructure edilmiyorlar. Task 8'de hepsi kullanılacak.)

- [ ] **Step 6: Tarayıcıda doğrula (Playwright MCP veya manuel)**

Dev server: `bun run dev` (arka planda). Sonra:
1. `/` → sağ-altta mavi FAB görünür. FAB'a tıkla → panel açılır, başlık "BakımX Asistanı".
2. Panel içi X'e tıkla → kapanır. FAB tekrar görünür.
3. `/login` → FAB **görünmez** (gate).
4. `/fiyatlar` → FAB görünür.

Expected: 4 madde de doğru.

- [ ] **Step 7: Commit**

```bash
git add src/components/site-assistant/site-assistant.tsx src/components/site-assistant/assistant-launcher.tsx src/components/site-assistant/assistant-panel.tsx src/app/layout.tsx
git commit -m "feat(site-assistant): FAB + panel kabuğu, kök layout mount, gate bağlı"
```

---

### Task 4: Menü görünümü (4 hızlı aksiyon)

Karşılama + 4 aksiyon satırı: Demo / Satın al / Destek / SSS. "Satın al" `/satin-al`'a link; diğerleri görünüm değiştirir.

**Files:**
- Create: `src/components/site-assistant/views/menu-view.tsx`
- Modify: `src/components/site-assistant/assistant-panel.tsx` (menü görünümünü bağla)

**Interfaces:**
- Consumes: `AssistantView` (Task 3)
- Produces: `MenuView` props `{ onNavigate: (view: AssistantView) => void }`

- [ ] **Step 1: `menu-view.tsx`**

Satırlar shadcn `Button` (variant="outline", `asChild` ile link). Native `<a>`/`<button>` liste satırı KULLANMA.

```tsx
"use client";

import { CalendarCheck, ShoppingCart, LifeBuoy, HelpCircle, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantView } from "../site-assistant";

interface MenuViewProps {
  onNavigate: (view: AssistantView) => void;
}

interface MenuAction {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  view?: Exclude<AssistantView, "menu" | "success">;
  href?: string;
}

const ACTIONS: MenuAction[] = [
  { key: "demo", label: "Demo talep et", description: "Size özel canlı tanıtım ayarlayalım", icon: CalendarCheck, view: "demo" },
  { key: "buy", label: "Satın al / Fiyatlar", description: "Anında 7 gün ücretsiz deneyin", icon: ShoppingCart, href: "/satin-al" },
  { key: "support", label: "Destek / İletişim", description: "Sorunuzu ekibimize iletelim", icon: LifeBuoy, view: "support" },
  { key: "faq", label: "Sık Sorulanlar", description: "En çok merak edilenler", icon: HelpCircle, view: "faq" },
];

function ActionInner({ action }: { action: MenuAction }) {
  const Icon = action.icon;
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{action.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );
}

const ROW_CLASS =
  "h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left";

export function MenuView({ onNavigate }: MenuViewProps) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl bg-muted/60 px-4 py-3">
        <p className="text-sm text-foreground">
          Merhaba! 👋 BakımX ile ilgilendiğiniz için teşekkürler. Size nasıl yardımcı olabiliriz?
        </p>
      </div>
      <div className="space-y-2">
        {ACTIONS.map((action) =>
          action.href ? (
            <Button key={action.key} asChild variant="outline" className={ROW_CLASS}>
              <a href={action.href}>
                <ActionInner action={action} />
              </a>
            </Button>
          ) : (
            <Button
              key={action.key}
              type="button"
              variant="outline"
              className={ROW_CLASS}
              onClick={() => action.view && onNavigate(action.view)}
            >
              <ActionInner action={action} />
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Paneli menü görünümüne bağla**

`assistant-panel.tsx` içinde import ekle ve placeholder gövdeyi menü için switch'e çevir (diğer view'lar Task 5-8'de eklenecek; şimdilik yalnız `menu`, gerisi placeholder):

```tsx
import { MenuView } from "./views/menu-view";
```

Gövdeyi değiştir:

```tsx
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "menu" && <MenuView onNavigate={onNavigate} />}
        {view !== "menu" && (
          <div className="p-4 text-sm text-muted-foreground">Görünüm: {view}</div>
        )}
      </div>
```

`AssistantPanel` imzasında `onNavigate`'i artık destructure et: `export function AssistantPanel({ view, onNavigate, onClose }: AssistantPanelProps) {`

- [ ] **Step 3: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hatasız.

- [ ] **Step 4: Tarayıcıda doğrula**

`/` → FAB → panel → 4 aksiyon satırı görünür (ikon + başlık + açıklama + ok). "Sık Sorulanlar"a tıkla → gövde "Görünüm: faq" placeholder'ına döner (henüz view yok). "Satın al" → `/satin-al`'a gider.
Expected: doğru.

- [ ] **Step 5: Commit**

```bash
git add src/components/site-assistant/views/menu-view.tsx src/components/site-assistant/assistant-panel.tsx
git commit -m "feat(site-assistant): menü görünümü — 4 hızlı aksiyon"
```

---

### Task 5: Demo formu görünümü

Panel-içi demo formu; mevcut `DemoRequestSection` desenini (Select+TR_CITIES, monthlyVehicles, hata sözleşmesi) izler. `POST /api/demo-request`. Başarıda `onSuccess("demo")`.

**Files:**
- Create: `src/components/site-assistant/views/demo-form-view.tsx`
- Modify: `src/components/site-assistant/assistant-panel.tsx` (demo view bağla)

**Interfaces:**
- Consumes: `SuccessContext` (Task 3), `TR_CITIES` from `@/lib/tr-cities`
- Produces: `DemoFormView` props `{ onBack: () => void; onSuccess: (context: SuccessContext) => void }`

- [ ] **Step 1: `demo-form-view.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TR_CITIES } from "@/lib/tr-cities";
import type { SuccessContext } from "../site-assistant";

interface DemoFormViewProps {
  onBack: () => void;
  onSuccess: (context: SuccessContext) => void;
}

interface FormData {
  name: string;
  businessName: string;
  phone: string;
  city: string;
  monthlyVehicles: string;
  notes: string;
}

interface FormErrors {
  name?: string;
  businessName?: string;
  phone?: string;
  city?: string;
  monthlyVehicles?: string;
  _general?: string;
}

const EMPTY: FormData = { name: "", businessName: "", phone: "", city: "", monthlyVehicles: "", notes: "" };

export function DemoFormView({ onBack, onSuccess }: DemoFormViewProps) {
  const [data, setData] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (data.name.trim().length < 2) e.name = "Ad Soyad en az 2 karakter olmalıdır";
    if (data.businessName.trim().length < 2) e.businessName = "İşletme adı en az 2 karakter olmalıdır";
    if (!data.phone.trim()) e.phone = "Telefon gerekli";
    else if (!/^[0-9+\-\s()]{7,15}$/.test(data.phone.trim())) e.phone = "Telefon numarası geçersiz görünüyor";
    if (!data.city) e.city = "Şehir seçimi gerekli";
    if (!data.monthlyVehicles) e.monthlyVehicles = "Aylık araç adedi gerekli";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        onSuccess("demo");
        return;
      }
      const body = await res.json().catch(() => null);
      if (body?.errors) setErrors(body.errors as FormErrors);
      else setErrors({ _general: body?.message ?? "Talep gönderilemedi. Lütfen tekrar deneyin." });
    } catch {
      setErrors({ _general: "Bağlantı hatası oluştu. Lütfen tekrar deneyin." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Geri
      </button>
      <p className="text-sm font-medium text-foreground">Demo talebi — sizi arayalım</p>

      {errors._general && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-foreground">
          {errors._general}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="da-name">Ad Soyad *</Label>
        <Input id="da-name" placeholder="Ahmet Yılmaz" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-business">İşletme Adı *</Label>
        <Input id="da-business" placeholder="Yılmaz Oto Servis" value={data.businessName} onChange={(e) => setData({ ...data, businessName: e.target.value })} />
        {errors.businessName && <p className="text-xs text-destructive">{errors.businessName}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-phone">Telefon *</Label>
        <Input id="da-phone" inputMode="tel" placeholder="0532 123 4567" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-city">Şehir *</Label>
        <Select value={data.city} onValueChange={(value) => setData({ ...data, city: value ?? "" })}>
          <SelectTrigger id="da-city" className="w-full">
            <SelectValue placeholder="Şehir seçin" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectGroup>
              {TR_CITIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-vehicles">Aylık ortalama araç adedi *</Label>
        <Select value={data.monthlyVehicles} onValueChange={(value) => setData({ ...data, monthlyVehicles: value ?? "" })}>
          <SelectTrigger id="da-vehicles" className="w-full">
            <SelectValue placeholder="Seçin" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="1-20">1 - 20</SelectItem>
              <SelectItem value="21-50">21 - 50</SelectItem>
              <SelectItem value="51-100">51 - 100</SelectItem>
              <SelectItem value="100+">100+</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {errors.monthlyVehicles && <p className="text-xs text-destructive">{errors.monthlyVehicles}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-notes">Not (opsiyonel)</Label>
        <Textarea id="da-notes" rows={2} placeholder="İhtiyacınızı kısaca yazın" value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gönderiliyor...
          </>
        ) : (
          "Demo Talep Et"
        )}
      </Button>
    </form>
  );
}
```

> Not: `da-*` id önekleri, sayfadaki `DemoRequestSection` id'leriyle (`name`, `city`...) çakışmayı önler.

- [ ] **Step 2: Paneli demo view'a bağla**

`assistant-panel.tsx`:

```tsx
import { DemoFormView } from "./views/demo-form-view";
```

Gövdeye ekle (menu satırından sonra), `onSuccess` prop'unu da destructure et — imza: `({ view, onNavigate, onSuccess, onClose }: AssistantPanelProps)`:

```tsx
        {view === "menu" && <MenuView onNavigate={onNavigate} />}
        {view === "demo" && <DemoFormView onBack={() => onNavigate("menu")} onSuccess={onSuccess} />}
        {(view === "support" || view === "faq" || view === "success") && (
          <div className="p-4 text-sm text-muted-foreground">Görünüm: {view}</div>
        )}
```

- [ ] **Step 3: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hatasız.

- [ ] **Step 4: Tarayıcıda doğrula**

`/` → FAB → "Demo talep et" → form açılır. Boş submit → alan hataları. Geçerli doldur + gönder → gövde "Görünüm: success" placeholder'ına geçer (success view Task 8'de). DB doğrulaması Task 9'da.
Expected: doğru.

- [ ] **Step 5: Commit**

```bash
git add src/components/site-assistant/views/demo-form-view.tsx src/components/site-assistant/assistant-panel.tsx
git commit -m "feat(site-assistant): demo talep formu görünümü → /api/demo-request"
```

---

### Task 6: Destek formu görünümü

`POST /api/support-request` (alanlar: name, businessName, email, phone, subject?, message). Başarıda `onSuccess("support")`.

**Files:**
- Create: `src/components/site-assistant/views/support-form-view.tsx`
- Modify: `src/components/site-assistant/assistant-panel.tsx` (support view bağla)

**Interfaces:**
- Produces: `SupportFormView` props `{ onBack: () => void; onSuccess: (context: SuccessContext) => void }`

- [ ] **Step 1: `support-form-view.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SuccessContext } from "../site-assistant";

interface SupportFormViewProps {
  onBack: () => void;
  onSuccess: (context: SuccessContext) => void;
}

interface FormData {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  message?: string;
  _general?: string;
}

const EMPTY: FormData = { name: "", businessName: "", email: "", phone: "", subject: "", message: "" };

export function SupportFormView({ onBack, onSuccess }: SupportFormViewProps) {
  const [data, setData] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (data.name.trim().length < 2) e.name = "Ad Soyad en az 2 karakter olmalıdır";
    if (data.businessName.trim().length < 2) e.businessName = "İşletme adı en az 2 karakter olmalıdır";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) e.email = "Geçerli bir e-posta girin";
    if (!/^[0-9+\-\s()]{7,15}$/.test(data.phone.trim())) e.phone = "Geçerli bir telefon girin";
    if (data.message.trim().length < 10) e.message = "Mesaj en az 10 karakter olmalıdır";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/support-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        onSuccess("support");
        return;
      }
      const body = await res.json().catch(() => null);
      if (body?.errors) setErrors(body.errors as FormErrors);
      else setErrors({ _general: body?.message ?? "Talep gönderilemedi. Lütfen tekrar deneyin." });
    } catch {
      setErrors({ _general: "Bağlantı hatası oluştu. Lütfen tekrar deneyin." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Geri
      </button>
      <p className="text-sm font-medium text-foreground">Destek / İletişim</p>

      {errors._general && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-foreground">
          {errors._general}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sa-name">Ad Soyad *</Label>
        <Input id="sa-name" placeholder="Ahmet Yılmaz" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-business">İşletme Adı *</Label>
        <Input id="sa-business" placeholder="Yılmaz Oto Servis" value={data.businessName} onChange={(e) => setData({ ...data, businessName: e.target.value })} />
        {errors.businessName && <p className="text-xs text-destructive">{errors.businessName}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-email">E-posta *</Label>
        <Input id="sa-email" type="email" inputMode="email" placeholder="ornek@servis.com" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-phone">Telefon *</Label>
        <Input id="sa-phone" inputMode="tel" placeholder="0532 123 4567" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-subject">Konu (opsiyonel)</Label>
        <Input id="sa-subject" placeholder="Konu başlığı" value={data.subject} onChange={(e) => setData({ ...data, subject: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-message">Mesajınız *</Label>
        <Textarea id="sa-message" rows={3} placeholder="Size nasıl yardımcı olabiliriz?" value={data.message} onChange={(e) => setData({ ...data, message: e.target.value })} />
        {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gönderiliyor...
          </>
        ) : (
          "Gönder"
        )}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Paneli support view'a bağla**

`assistant-panel.tsx`:

```tsx
import { SupportFormView } from "./views/support-form-view";
```

```tsx
        {view === "support" && <SupportFormView onBack={() => onNavigate("menu")} onSuccess={onSuccess} />}
```

placeholder koşulundan `"support"`'u çıkar → `{(view === "faq" || view === "success") && (...placeholder...)}`

- [ ] **Step 3: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hatasız.

- [ ] **Step 4: Tarayıcıda doğrula**

`/` → FAB → "Destek / İletişim" → form. Geçersiz e-posta/kısa mesaj → hatalar. Geçerli → success placeholder.
Expected: doğru.

- [ ] **Step 5: Commit**

```bash
git add src/components/site-assistant/views/support-form-view.tsx src/components/site-assistant/assistant-panel.tsx
git commit -m "feat(site-assistant): destek formu görünümü → /api/support-request"
```

---

### Task 7: SSS görünümü

`FAQ_ITEMS`'tan (Task 1) accordion + geri butonu.

**Files:**
- Create: `src/components/site-assistant/views/faq-view.tsx`
- Modify: `src/components/site-assistant/assistant-panel.tsx` (faq view bağla)

**Interfaces:**
- Consumes: `FAQ_ITEMS` (Task 1), `Accordion` from `@/components/ui/accordion`
- Produces: `FaqView` props `{ onBack: () => void }`

- [ ] **Step 1: `faq-view.tsx`**

```tsx
"use client";

import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/faq-data";

interface FaqViewProps {
  onBack: () => void;
}

export function FaqView({ onBack }: FaqViewProps) {
  return (
    <div className="space-y-3 p-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Geri
      </button>
      <p className="text-sm font-medium text-foreground">Sık Sorulanlar</p>
      <Accordion className="w-full">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`q-${i}`}>
            <AccordionTrigger className="py-3 text-left text-sm font-medium">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="pb-3 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
```

- [ ] **Step 2: Paneli faq view'a bağla**

`assistant-panel.tsx`:

```tsx
import { FaqView } from "./views/faq-view";
```

```tsx
        {view === "faq" && <FaqView onBack={() => onNavigate("menu")} />}
```

placeholder koşulunu `{view === "success" && (...placeholder...)}`'a indir.

- [ ] **Step 3: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hatasız.

- [ ] **Step 4: Tarayıcıda doğrula**

`/` → FAB → "Sık Sorulanlar" → sorular listelenir, biri açılıp kapanır. İçerik landing SSS ile birebir. "Geri" → menü.
Expected: doğru.

- [ ] **Step 5: Commit**

```bash
git add src/components/site-assistant/views/faq-view.tsx src/components/site-assistant/assistant-panel.tsx
git commit -m "feat(site-assistant): SSS görünümü (faq-data ortak kaynak)"
```

---

### Task 8: Başarı görünümü + menü dönüş bağlama

Context'e göre teşekkür mesajı + "Yeni talep" (menüye) + "Kapat". Kalan placeholder tamamen kalkar.

**Files:**
- Create: `src/components/site-assistant/views/success-view.tsx`
- Modify: `src/components/site-assistant/assistant-panel.tsx` (success view bağla, placeholder kaldır)

**Interfaces:**
- Consumes: `SuccessContext` (Task 3)
- Produces: `SuccessView` props `{ context: SuccessContext; onReset: () => void; onClose: () => void }`

- [ ] **Step 1: `success-view.tsx`**

```tsx
"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SuccessContext } from "../site-assistant";

interface SuccessViewProps {
  context: SuccessContext;
  onReset: () => void;
  onClose: () => void;
}

const MESSAGES: Record<SuccessContext, { title: string; body: string }> = {
  demo: {
    title: "Demo talebiniz alındı!",
    body: "En kısa sürede sizinle iletişime geçeceğiz. İlginiz için teşekkürler.",
  },
  support: {
    title: "Talebiniz alındı!",
    body: "Ekibimiz en kısa sürede size dönecek. İlginiz için teşekkürler.",
  },
};

export function SuccessView({ context, onReset, onClose }: SuccessViewProps) {
  const m = MESSAGES[context];
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-6 w-6 text-success" />
      </span>
      <p className="text-base font-semibold text-foreground">{m.title}</p>
      <p className="text-sm text-muted-foreground">{m.body}</p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          Başka bir şey sor
        </Button>
        <Button type="button" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Paneli success view'a bağla ve placeholder'ı kaldır**

`assistant-panel.tsx`:

```tsx
import { SuccessView } from "./views/success-view";
```

Gövdeyi son haline getir (imza: `({ view, successContext, onNavigate, onSuccess, onClose }: AssistantPanelProps)`):

```tsx
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "menu" && <MenuView onNavigate={onNavigate} />}
        {view === "demo" && <DemoFormView onBack={() => onNavigate("menu")} onSuccess={onSuccess} />}
        {view === "support" && <SupportFormView onBack={() => onNavigate("menu")} onSuccess={onSuccess} />}
        {view === "faq" && <FaqView onBack={() => onNavigate("menu")} />}
        {view === "success" && (
          <SuccessView context={successContext} onReset={() => onNavigate("menu")} onClose={onClose} />
        )}
      </div>
```

- [ ] **Step 3: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hatasız (artık tüm prop'lar kullanılıyor).

- [ ] **Step 4: Tarayıcıda doğrula**

`/` → FAB → Demo formunu geçerli doldur + gönder → başarı ekranı ("Demo talebiniz alındı!"). "Başka bir şey sor" → menü. Destek formu → "Talebiniz alındı!".
Expected: doğru.

- [ ] **Step 5: Commit**

```bash
git add src/components/site-assistant/views/success-view.tsx src/components/site-assistant/assistant-panel.tsx
git commit -m "feat(site-assistant): başarı görünümü + görünüm makinesi tamamlandı"
```

---

### Task 9: Uçtan uca doğrulama + son cila

Tüm akış, gate, mobil ve DB kaydı doğrulanır. Kod değişikliği yalnız QA'da çıkan ufak düzeltmeler için.

**Files:**
- Modify: (yalnız QA'da bulunan sorunlar için ilgili widget dosyaları)

- [ ] **Step 1: Statik kontroller**

Run: `bun run typecheck && bun run lint && bun test`
Expected: hepsi geçer (faq-data + visibility testleri dahil).

- [ ] **Step 2: Build (değişiklik anlamlı olduğundan)**

Run: `bun run build`
Expected: başarılı derleme (SiteAssistant client component'i sınır hatası vermemeli).

- [ ] **Step 3: Fonksiyonel QA (Playwright MCP veya manuel), dev server açık**

Aşağıdakileri doğrula ve sonuçları not et:
1. `/` FAB görünür; açılır; menü 4 aksiyon.
2. Demo formu: boş submit → alan hataları; geçerli submit → başarı ekranı.
3. Destek formu: geçersiz e-posta → hata; geçerli submit → başarı ekranı.
4. "Satın al" → `/satin-al`.
5. SSS: açılır/kapanır; içerik landing ile birebir.
6. Public sayfalar `/fiyatlar`, `/demo`, `/satin-al`, `/terms`, `/privacy`: FAB görünür.
7. `/login`, `/register`: FAB **görünmez**.
8. Mobil viewport (375px): panel taşmıyor, tam genişlik, kapat çalışıyor.
9. Esc → panel kapanır.
10. Panel açıkken sayfa yenile → açık kalır (localStorage); kapat → yenile → kapalı.

- [ ] **Step 4: DB kayıt doğrulaması**

Demo ve destek formundan birer geçerli talep gönder. Admin girişiyle:
- `/admin/leads` → "Demo Talepleri"nde yeni kayıt görünür.
- Aynı sayfada "Destek Talepleri"nde yeni kayıt görünür.

(Alternatif: `bun run db:studio` ile `DemoRequest` / `SupportRequest` tablolarında yeni satırları doğrula.)

Expected: her iki kayıt da düşer.

- [ ] **Step 5: Uygulama içi gate son kontrolü**

Admin/servis hesabıyla giriş yap → `/dashboard` ve `/admin` → FAB **görünmez**.
Expected: doğru.

- [ ] **Step 6: (Varsa) düzeltmeleri uygula ve commit**

QA'da sorun çıktıysa düzelt, ardından:

```bash
git add src/components/site-assistant
git commit -m "fix(site-assistant): QA düzeltmeleri"
```

- [ ] **Step 7: Branch'i entegrasyona hazırla**

`finishing-a-development-branch` skill'i ile merge/PR seçeneklerini sun. (dev entegrasyon dalıdır.)

---

## Self-Review Notları

- **Spec kapsamı:** §3 mimari → Task 2+3; §4 bileşenler → Task 3-8; §5 UI kuralları → Global Constraints + her UI task; §6 davranış (localStorage/Esc/reset) → Task 3 (localStorage+Esc), Task 8 (reset menüye); §7 dosyalar → File Structure; §9 QA → Task 9. FAQ tek-kaynak (§4) → Task 1.
- **Spec sapması (bilerek):** Spec §6 "kapatınca oturumlar arası kapalı kalır" + "auto-hello yok" → localStorage yalnız **açık/kapalı durumunu** korur (auto-açılış yok). Bu, spec'in "ilk ziyaret kapalı, kullanıcı kontrolünde" niyetini karşılar.
- **Tip tutarlılığı:** `AssistantView`/`SuccessContext` Task 3'te tanımlı; tüm view'lar aynı imzayı tüketir. `onSuccess(context)`, `onNavigate(view)`, `onBack = () => onNavigate("menu")` tutarlı.
- **Placeholder yok:** Tüm adımlarda tam kod var; ara görevlerdeki geçici panel gövdesi her task'ta açıkça değiştiriliyor, Task 8'de tamamen kalkıyor.
- **Test gerçekliği:** Component test altyapısı olmadığından UI doğrulaması typecheck+lint+build+Playwright/manuel; saf mantık (`faq-data`, `visibility`) `bun test` ile TDD.
