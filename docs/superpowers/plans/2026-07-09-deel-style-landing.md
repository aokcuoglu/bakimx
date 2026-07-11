# Deel-Tarzı Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `bakimx.com` kök landing page'ini Deel.com yapısını referans alan 9 bölümlük profesyonel sayfaya dönüştürmek (spec: `docs/superpowers/specs/2026-07-09-deel-style-landing-design.md`).

**Architecture:** Mevcut `src/components/sections/*` bölümleri yeniden yazılır; yeni bölümler önce bağımsız component olarak eklenir (build yeşil kalır), son assembly task'ında `page.tsx` yeni sırayla kurulup eski bölümler silinir. Gerçek ekran görüntüleri Playwright ile local demo hesabından çekilip `public/landing/screens/` altına konur; `/landing/*` middleware'den muaf tutulur.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 token'ları (`brand`, `navy-light`, `success`, `whatsapp`), framer-motion, lucide-react, shadcn/Base UI (`Button`, `Input`, `Label`, `Select`, `Accordion`), `next/image`.

## Global Constraints

- Şema/migration değişikliği YOK; yeni npm bağımlılığı YOK; backend'de yalnız mevcut `/api/demo-request` kullanılır (endpoint değişmez).
- Tüm kullanıcıya görünen metinler Türkçe.
- Dürüstlük kuralları: sahte istatistik/testimonial/G2-puanı YOK; var olmayan özellik (parça-fiyat karşılaştırma, AI fiyat kıyası) asla yazılmaz; logo şeridi başlığı iş-ortağı çerçevesinde ("müşterimiz" iddiası yok).
- Marka: only-logo (BrandLogo traced X); wordmark görseli hiçbir yüzeyde kullanılmaz, "BakimX" yalnız metin olarak yazılır.
- UI: yalnız mevcut `@/components/ui/*` bileşenleri (Base UI tabanlı); form bileşenleri varsayılan yükseklikte bırakılır (web'de h-9), birincil CTA'lar `size="lg"`.
- Base UI Select tuzağı: `SelectValue` ham value gösterir — value'su insan-okur olmayan Select kullanma (bu plandaki value'lar zaten okunur).
- Animasyon deseni: `framer-motion` + `useReducedMotion` guard (mevcut bölümlerdeki desenin aynısı).
- Mobil öncelik: her bölüm önce tek kolon; `max-w-7xl px-4 sm:px-6 lg:px-8` konteyner deseni.
- Her task sonunda `bun lint && bun typecheck` yeşil olmalı; commit'ler küçük ve konu-odaklı.
- Local DB gerekirse: `docker compose -f docker-compose.local.yml up -d` (OrbStack; ECONNREFUSED 5432 = compose ayakta değil).

## Test Yaklaşımı

Repo'da React component test altyapısı yok (bun test yalnız `src/lib/*.test.ts` çalıştırır); bölümler saf sunum JSX'i. Bu yüzden task döngüsü: **kod → `bun lint && bun typecheck` → commit**; davranış doğrulaması Task 11'de gerçek tarayıcıyla (Playwright) yapılır. Mevcut `bun test` (faq-data testi) assembly ve QA task'larında koşulur.

## Dosya Haritası

| Dosya | İşlem | Sorumluluk |
|---|---|---|
| `middleware.ts` | Modify | `/landing/*` asset muafiyeti |
| `public/landing/partners/mutlu.svg`, `aws-startups.jpg` | Create | Self-host partner logoları |
| `public/landing/screens/order-detail.png`, `parts-catalog.png`, `public-tracking.png` | Create | Gerçek ekran görüntüleri |
| `src/components/sections/HeroSection.tsx` | Rewrite | Highlight başlık + sol kolon |
| `src/components/sections/HeroLeadForm.tsx` | Create | Lead form kartı (client) |
| `src/components/sections/PillarsSection.tsx` | Create | 3'lü kart bandı |
| `src/components/sections/PartnersStrip.tsx` | Create | Logo şeridi |
| `src/components/sections/DeviceFrame.tsx` | Create | Browser/telefon CSS çerçeveleri |
| `src/components/sections/FeatureShowcaseSection.tsx` | Create | Dönüşümlü screenshot bantları |
| `src/components/sections/StandOutSection.tsx` | Create | Koyu "bizi ayıran" bandı |
| `src/components/sections/BeforeAfterSection.tsx` | Create | Öncesi/Sonrası bandı |
| `src/components/sections/FinalCTASection.tsx` | Create | Son CTA |
| `src/components/sections/FAQSection.tsx` | Rewrite | Deel iki-kolon SSS |
| `src/components/sections/Header.tsx` | Modify | Nav çapaları |
| `src/components/sections/Footer.tsx` | Modify | Ürün link çapaları |
| `src/app/page.tsx` | Rewrite | Yeni bölüm sırası |
| `TrustStrip/Modules/HowItWorks/FeatureSpotlight/WhyBakimx/EarlyAccessCTA/car-damage-illustration` | Delete | Eski bölümler (yalnız page.tsx + kendi aralarında import ediliyor — doğrulandı) |

Not: `RuhsatDemoSection.tsx` DEĞİŞMEZ — zaten `SectionHeading` + `bg-muted/30` kullanıyor, yeni görsel dile uyumlu (spec'in "uyarlanır" maddesi mevcut haliyle karşılanıyor). `DemoRequestSection.tsx` `/demo` sayfasında kalır, silinmez.

---

### Task 1: Middleware muafiyeti + partner logoları

**Files:**
- Modify: `middleware.ts:116`
- Create: `public/landing/partners/mutlu.svg`
- Create: `public/landing/partners/aws-startups.jpg`

**Interfaces:**
- Produces: `/landing/**` altındaki statik asset'ler middleware'e girmeden servis edilir (prod'da app-host redirect'ine yakalanmaz). Task 5 ve 6 bu yolları kullanır.

- [ ] **Step 1: Matcher'a `landing/` muafiyeti ekle**

`middleware.ts` içinde config matcher'ı şu şekilde değiştir (yalnız `landing/|` eklenir):

```ts
export const config = {
  // Statik public asset'leri (özellikle BrandLogo'nun 01..04-bakimx-* logo
  // variant'ları) middleware'den muaf tut. Aksi halde kök görsel istekleri
  // auth-gate edilip /login'e 307'lenir; bu yüzden staging/prod'da (next
  // start/standalone, dev'in aksine, middleware'i public static'lerde de
  // çalıştırır) logolar kayboluyordu — hem doğrudan erişimde hem next/image'in
  // kaynak fetch'inde. Ayrıca transactional e-postaların logosu (02-bakimx-
  // primary-dark.png) anonim çekildiği için kök PNG'ler de PUBLIC olmalı.
  // Kökteki tüm görsel dosyaları (svg/png/jpg/jpeg/webp/gif/ico) ve landing
  // marketing asset'leri (/landing/**) hariç bırakılır.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|landing/|[^/]+\\.(?:svg|png|jpe?g|webp|gif|ico)$).*)"],
}
```

- [ ] **Step 2: Logoları indir**

```bash
mkdir -p public/landing/partners
curl -sL "https://www.mutlu.com.tr/images/logo.svg" -o public/landing/partners/mutlu.svg
curl -sL "https://pbs.twimg.com/media/EmqJX_QW8AI3OwG.jpg" -o public/landing/partners/aws-startups.jpg
file public/landing/partners/mutlu.svg public/landing/partners/aws-startups.jpg
```

Expected: `mutlu.svg: SVG Scalable Vector Graphics image`, `aws-startups.jpg: JPEG image data ... 1024x536`. İçeriği görsel olarak kontrol et (Read ile aç): Mutlu Akü logosu ve "aws startups" yazılı logo olmalı.

- [ ] **Step 3: Lint + typecheck**

Run: `bun lint && bun typecheck`
Expected: her ikisi de hatasız.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts public/landing/partners
git commit -m "feat(landing): partner logoları + /landing asset middleware muafiyeti"
```

---

### Task 2: Gerçek ekran görüntüleri (INLINE — ana oturum, Playwright MCP gerekir)

> Bu task subagent'a verilmez; dev server + Playwright MCP + görsel muhakeme gerektirir. Ana oturumda çalıştırılır.

**Files:**
- Create: `public/landing/screens/order-detail.png` (desktop, 1440×900 viewport)
- Create: `public/landing/screens/parts-catalog.png` (desktop, 1440×900 viewport)
- Create: `public/landing/screens/public-tracking.png` (mobil, 390×844 viewport)

**Interfaces:**
- Produces: Task 6'nın `next/image` ile kullanacağı üç PNG. Boyut oranları: desktop 1440×900, mobil 390×844 (crop sonrası gerçek piksel boyutu `sips -g pixelWidth -g pixelHeight` ile okunup Task 6'daki `width/height` prop'larına yazılır).

- [ ] **Step 1: Local altyapıyı kaldır**

```bash
docker compose -f docker-compose.local.yml up -d
bun dev  # arka planda (run_in_background)
```

Expected: Postgres+MinIO ayakta, dev server `http://localhost:3000`.

- [ ] **Step 2: Seed verisinin varlığını doğrula**

```bash
bunx tsx -e "import {prisma} from './src/lib/db'; prisma.workOrder.count().then(c=>{console.log('orders:',c); process.exit(0)})"
```

Expected: `orders:` ≥ 1. 0 ise `bun run db:seed` çalıştır.

- [ ] **Step 3: Playwright ile giriş yap**

Playwright MCP: viewport 1440×900'e resize → `http://localhost:3000/login` → `admin@bakimx.com` / `admin123456` ile giriş → `/dashboard` yüklendiğini doğrula.

- [ ] **Step 4: İş emri detayı ekranı**

`/orders` → listeden dolu görünen (fotoğraflı/kalemli) bir iş emri aç → sayfanın üst kısmı (başlık + durum + fotoğraf checklist alanı görünür olacak şekilde) screenshot al → `public/landing/screens/order-detail.png` olarak kopyala.

- [ ] **Step 5: Parça kataloğu ekranı**

Aynı iş emrinde parça ekleme/katalog seçici bölümünü aç (araca uygun parça listesi görünür olsun) → screenshot → `public/landing/screens/parts-catalog.png`.

- [ ] **Step 6: Public takip sayfası (mobil)**

İş emri detayındaki müşteri paylaşım linkini (`/s/<token>`) al → viewport'u 390×844'e resize → linke git → screenshot → `public/landing/screens/public-tracking.png`.

- [ ] **Step 7: Veri hijyeni + optimize**

Üç görselde yalnız seed/demo verisi olduğunu görsel olarak doğrula (gerçek kişi adı/telefon/plaka olmamalı; seed "Demo Oto Servis" verisi beklenir). Sonra:

```bash
sips -g pixelWidth -g pixelHeight public/landing/screens/*.png
```

Boyutları not et (Task 6'da kullanılacak). 500 KB üzeri dosya varsa `sips -Z 1600 <dosya>` ile küçült (next/image servis anında WebP/AVIF'e çevirir; ayrıca elle WebP dönüşümü gerekmez).

- [ ] **Step 8: Commit**

```bash
git add public/landing/screens
git commit -m "feat(landing): gerçek uygulama ekran görüntüleri"
```

---

### Task 3: HeroLeadForm + HeroSection rewrite

**Files:**
- Create: `src/components/sections/HeroLeadForm.tsx`
- Rewrite: `src/components/sections/HeroSection.tsx`

**Interfaces:**
- Consumes: `POST /api/demo-request` — body `{name, businessName, phone, city, monthlyVehicles, notes?}` (hepsi zorunlu, notes hariç); 200 `{success:true}`, 400/429 `{success:false, errors:{alan|_general: string}}`.
- Produces: `HeroLeadForm` (props'suz named export, client component); `HeroSection` (named export). Hero form kartı `id="demo-form"` taşır — FinalCTA ve Header "Demo İste" linkleri `/#demo-form`'a işaret eder.

- [ ] **Step 1: HeroLeadForm.tsx oluştur**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, ShieldCheck, Zap, CalendarCheck, ArrowRight } from "lucide-react";
import { TR_CITIES } from "@/lib/tr-cities";

interface FormData {
  name: string;
  businessName: string;
  phone: string;
  city: string;
  monthlyVehicles: string;
}

type FormErrors = Partial<Record<keyof FormData | "_general", string>>;

const EMPTY_FORM: FormData = {
  name: "",
  businessName: "",
  phone: "",
  city: "",
  monthlyVehicles: "",
};

const trustBadges = [
  { icon: ShieldCheck, label: "KVKK uyumlu" },
  { icon: Zap, label: "Kurulumsuz" },
  { icon: CalendarCheck, label: "7 gün ücretsiz" },
];

export function HeroLeadForm() {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (formData.name.trim().length < 2) errs.name = "Ad Soyad en az 2 karakter olmalıdır";
    if (formData.businessName.trim().length < 2) errs.businessName = "Servis adı en az 2 karakter olmalıdır";
    if (!formData.phone.trim()) {
      errs.phone = "Telefon gerekli";
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(formData.phone.trim())) {
      errs.phone = "Telefon numarası geçersiz görünüyor";
    }
    if (!formData.city) errs.city = "Şehir seçin";
    if (!formData.monthlyVehicles) errs.monthlyVehicles = "Aylık araç adedi seçin";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsSuccess(true);
      } else {
        try {
          const data = await res.json();
          setErrors(
            data.errors ?? { _general: "Form gönderilemedi. Lütfen alanları kontrol edin." }
          );
        } catch {
          setErrors({ _general: "Form gönderilemedi. Lütfen alanları kontrol edin." });
        }
      }
    } catch {
      setErrors({ _general: "Bağlantı hatası oluştu. Lütfen tekrar deneyin." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div id="demo-form" className="rounded-xl border bg-card p-8 shadow-xl text-center scroll-mt-24">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h3 className="text-xl font-bold">Talebiniz alındı!</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          En kısa sürede sizi arayacağız. Beklemeden kendiniz de başlayabilirsiniz:
        </p>
        <Link
          href="/register"
          className={buttonVariants({ size: "lg", className: "mt-5 w-full gap-2" })}
        >
          7 Gün Ücretsiz Dene
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div id="demo-form" className="rounded-xl border bg-card p-6 sm:p-8 shadow-xl scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        {trustBadges.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {label}
          </span>
        ))}
      </div>
      <h3 className="text-center text-xl font-bold">Hemen başlayın</h3>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Bilgilerinizi bırakın, sizi arayalım.
      </p>
      {errors._general && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm">
          {errors._general}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hero-name">Ad Soyad</Label>
            <Input
              id="hero-name"
              placeholder="Ahmet Yılmaz"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hero-phone">Telefon</Label>
            <Input
              id="hero-phone"
              type="tel"
              placeholder="0532 123 4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-businessName">Servis adı</Label>
          <Input
            id="hero-businessName"
            placeholder="Yılmaz Oto Servis"
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          />
          {errors.businessName && <p className="text-xs text-destructive">{errors.businessName}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hero-city">Şehir</Label>
            <Select
              value={formData.city}
              onValueChange={(value) => setFormData({ ...formData, city: value ?? "" })}
            >
              <SelectTrigger id="hero-city" className="w-full">
                <SelectValue placeholder="Şehir seçin" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectGroup>
                  {TR_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hero-monthlyVehicles">Aylık araç adedi</Label>
            <Select
              value={formData.monthlyVehicles}
              onValueChange={(value) => setFormData({ ...formData, monthlyVehicles: value ?? "" })}
            >
              <SelectTrigger id="hero-monthlyVehicles" className="w-full">
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
            {errors.monthlyVehicles && (
              <p className="text-xs text-destructive">{errors.monthlyVehicles}</p>
            )}
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full text-base" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gönderiliyor...
            </>
          ) : (
            "Demo İste"
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Bilgileriniz yalnız sizinle iletişim için kullanılır.{" "}
          <Link href="/kvkk" className="underline hover:text-foreground">
            KVKK Aydınlatma Metni
          </Link>
        </p>
      </form>
      <div className="mt-4 border-t pt-4 text-center">
        <Link href="/register" className="text-sm font-medium text-primary hover:underline">
          Ya da beklemeden 7 gün ücretsiz deneyin →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: HeroSection.tsx'i yeniden yaz** (dosyanın tamamı değişir)

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ScanLine } from "lucide-react";
import { HeroLeadForm } from "@/components/sections/HeroLeadForm";

const valueItems = [
  "Ruhsatı okutun, araç ve müşteri saniyede kaydolsun",
  "İş emri, fotoğraf kanıtı, teklif ve tahsilat tek ekranda",
  "Müşteriniz aracını canlı takip linkinden izlesin",
];

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-card px-2 shadow-sm box-decoration-clone">
      {children}
    </span>
  );
}

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-brand/10 pt-10 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="flex max-w-xl flex-col gap-6 lg:pt-6">
            <motion.h1
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl font-bold leading-snug tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.25]"
            >
              Aracı <Highlight>saniyede</Highlight> kabul edin, servisi{" "}
              <Highlight>kağıtsız</Highlight> yönetin
            </motion.h1>
            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-base leading-relaxed text-foreground/80 sm:text-lg"
            >
              BakimX, oto servisinizin tüm operasyonunu tek panelde toplar: araç
              kabulden iş emrine, fotoğraflı kanıttan teklife ve tahsilata.
              Ruhsatı okutun, gerisini sistem doldursun.
            </motion.p>
            <motion.ul
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="space-y-2.5"
            >
              {valueItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </motion.ul>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.55 }}
            >
              <a
                href="#ruhsat-demo"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <ScanLine className="h-4 w-4" />
                Ruhsat okumayı canlı deneyin
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full lg:max-w-md lg:justify-self-end"
          >
            <HeroLeadForm />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Lint + typecheck**

Run: `bun lint && bun typecheck`
Expected: hatasız. (Eski `HeroScanMock` importları dosyayla birlikte gittiği için kalıntı olmamalı.)

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/HeroSection.tsx src/components/sections/HeroLeadForm.tsx
git commit -m "feat(landing): Deel-tarzı hero — highlight başlık + lead formu"
```

---

### Task 4: PillarsSection (3'lü kart bandı)

**Files:**
- Create: `src/components/sections/PillarsSection.tsx`

**Interfaces:**
- Produces: `PillarsSection` named export; hero'nun açık mavi zeminini devam ettirir (`bg-brand/10`, üst kenarı hero ile bitişik).

- [ ] **Step 1: Component'i yaz**

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ScanLine,
  Camera,
  MessageSquare,
  CheckCircle2,
  Lock,
  Car,
} from "lucide-react";

export function PillarsSection() {
  const prefersReducedMotion = useReducedMotion();

  const pillars = [
    {
      title: "Saniyede araç kabul",
      description:
        "Ruhsatı telefon kamerasıyla okutun; araç, müşteri ve şasi bilgisi otomatik dolsun.",
      vignette: (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-mono text-sm font-semibold">34 ABC 123</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              <CheckCircle2 className="h-3 w-3" />
              Otomatik dolduruldu
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded bg-muted/60 px-2 py-1">Honda Civic 1.6</span>
            <span className="rounded bg-muted/60 px-2 py-1">2018 · Dizel</span>
          </div>
        </div>
      ),
    },
    {
      title: "Fotoğraflı iş emri",
      description:
        "Hasar haritası ve fotoğraf kanıtı iş emrine kilitlenir; sonradan değiştirilemez, anlaşmazlık biter.",
      vignette: (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Kabul fotoğrafları</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" />
              Değiştirilemez
            </span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex h-9 flex-1 items-center justify-center rounded bg-muted/70"
              >
                <Camera className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Müşteri hep haberdar",
      description:
        "Teklif ve servis durumu WhatsApp'tan gider; müşteri aracını canlı takip linkinden izler.",
      vignette: (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-whatsapp/10">
              <MessageSquare className="h-3.5 w-3.5 text-whatsapp" />
            </div>
            <div className="rounded-lg rounded-tl-none bg-muted/70 px-2.5 py-1.5 text-[11px] leading-snug">
              Aracınızın bakımı tamamlandı. Detaylar: bakimx.com/s/a3k…
            </div>
          </div>
          <p className="mt-2 text-right text-[10px] text-muted-foreground">
            Teklif #1042 · görüntülendi ✓
          </p>
        </div>
      ),
    },
  ];

  return (
    <section className="bg-brand/10 pb-16 sm:pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          Servisinizin dijital operasyon merkezi
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="flex flex-col gap-4 rounded-xl bg-background/60 p-5 sm:p-6"
            >
              <div className="rounded-xl bg-brand/10 p-4">{pillar.vignette}</div>
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  {i === 0 && <ScanLine className="h-5 w-5 text-primary" />}
                  {i === 1 && <Camera className="h-5 w-5 text-primary" />}
                  {i === 2 && <MessageSquare className="h-5 w-5 text-primary" />}
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `bun lint && bun typecheck` — Expected: hatasız.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/PillarsSection.tsx
git commit -m "feat(landing): 3'lü operasyon kartı bandı (PillarsSection)"
```

---

### Task 5: PartnersStrip (logo şeridi)

**Files:**
- Create: `src/components/sections/PartnersStrip.tsx`

**Interfaces:**
- Consumes: Task 1'in `public/landing/partners/mutlu.svg` ve `aws-startups.jpg` dosyaları.
- Produces: `PartnersStrip` named export.

- [ ] **Step 1: Component'i yaz**

```tsx
"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

const partners = [
  {
    name: "Mutlu Akü",
    src: "/landing/partners/mutlu.svg",
    width: 137,
    height: 36,
  },
  {
    name: "AWS Startups",
    src: "/landing/partners/aws-startups.jpg",
    width: 96,
    height: 50,
  },
];

export function PartnersStrip() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="border-b bg-background py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Güçlü iş ortakları ve altyapıyla çalışıyoruz
        </motion.p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-14 gap-y-6">
          {partners.map((partner, i) => (
            <motion.div
              key={partner.name}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Image
                src={partner.src}
                alt={partner.name}
                width={partner.width}
                height={partner.height}
                className="opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 dark:mix-blend-screen dark:invert-0"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

Not: `aws-startups.jpg` beyaz zeminli JPEG; light temada `grayscale`+`opacity` yeterli, dark temada beyaz kutu görünmemesi için görsel QA'da kontrol edilir — sorun çıkarsa `dark:opacity-80 dark:brightness-90 rounded` yaklaşımına geçilir (QA Task 11 kapsamında).

- [ ] **Step 2: Lint + typecheck**

Run: `bun lint && bun typecheck` — Expected: hatasız.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/PartnersStrip.tsx
git commit -m "feat(landing): iş ortağı logo şeridi (PartnersStrip)"
```

---

### Task 6: DeviceFrame + FeatureShowcaseSection (screenshot bantları)

**Files:**
- Create: `src/components/sections/DeviceFrame.tsx`
- Create: `src/components/sections/FeatureShowcaseSection.tsx`

**Interfaces:**
- Consumes: Task 2'nin `public/landing/screens/*.png` görselleri (gerçek piksel boyutları Task 2 Step 7'de not edildi — aşağıdaki `width/height` değerlerini onlarla değiştir).
- Produces: `BrowserFrame`, `PhoneFrame` (children alan named export'lar); `FeatureShowcaseSection` named export, `id="ozellikler"`.

- [ ] **Step 1: DeviceFrame.tsx'i yaz**

```tsx
export function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-2xl">
      <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        <div className="mx-auto flex h-5 w-1/2 items-center justify-center rounded bg-background text-[10px] text-muted-foreground">
          app.bakimx.com
        </div>
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2rem] border-[6px] border-foreground/80 bg-card shadow-2xl">
      <div className="flex justify-center bg-card py-1.5">
        <span className="h-1.5 w-16 rounded-full bg-foreground/20" />
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: FeatureShowcaseSection.tsx'i yaz**

`width/height` değerlerini Task 2'de not edilen gerçek boyutlarla değiştir.

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { BrowserFrame, PhoneFrame } from "@/components/sections/DeviceFrame";

interface Feature {
  kicker: string;
  title: string;
  description: string;
  bullets: string[];
  image: { src: string; width: number; height: number; alt: string };
  frame: "browser" | "phone";
}

const features: Feature[] = [
  {
    kicker: "İş Emri",
    title: "Tek iş emrinde her şey: fotoğraf, kalem, onay",
    description:
      "Kabulden teslimata bütün süreç tek sayfada. Fotoğraf kanıtı ve hasar haritası iş emrine kilitlenir; işlem geçmişi kim-ne-zaman yaptı gösterir.",
    bullets: [
      "Fotoğraf checklist ve hasar işaretleme",
      "Kanıtlar değiştirilemez — anlaşmazlık biter",
      "Teklif, onay ve tahsilat aynı ekranda",
    ],
    image: {
      src: "/landing/screens/order-detail.png",
      width: 1440,
      height: 900,
      alt: "BakimX iş emri detay ekranı",
    },
    frame: "browser",
  },
  {
    kicker: "Parça Kataloğu",
    title: "Şasiden araca uygun parçayı bulun",
    description:
      "Ruhsattan gelen şasi (VIN) numarası araç modeliyle eşleşir; iş emrine parça eklerken yalnız o araca uyan parçaları görürsünüz.",
    bullets: [
      "VIN'den otomatik araç eşleşmesi",
      "Araca uygun parça listesi, elle arama yok",
      "Seçilen parça tek tıkla iş emri kalemi olur",
    ],
    image: {
      src: "/landing/screens/parts-catalog.png",
      width: 1440,
      height: 900,
      alt: "BakimX araca uygun parça kataloğu",
    },
    frame: "browser",
  },
  {
    kicker: "Müşteri Deneyimi",
    title: "Müşteriniz aracını canlı izler",
    description:
      "Her iş emri için güvenli bir takip linki oluşur. Müşteri telefonundan aracın durumunu, fotoğrafları ve teklifi görür — sizi aramasına gerek kalmaz.",
    bullets: [
      "Kişiye özel güvenli takip linki",
      "WhatsApp'tan tek dokunuşla paylaşım",
      "Onay ve teslimat kayıt altında",
    ],
    image: {
      src: "/landing/screens/public-tracking.png",
      width: 390,
      height: 844,
      alt: "Müşteri canlı servis takip sayfası (mobil)",
    },
    frame: "phone",
  },
];

export function FeatureShowcaseSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="ozellikler" className="scroll-mt-24 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl space-y-20 px-4 sm:px-6 sm:space-y-28 lg:px-8">
        {features.map((feature, i) => {
          const reversed = i % 2 === 1;
          return (
            <div
              key={feature.title}
              className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                reversed ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, x: reversed ? 24 : -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5 }}
              >
                {feature.frame === "browser" ? (
                  <BrowserFrame>
                    <Image
                      src={feature.image.src}
                      alt={feature.image.alt}
                      width={feature.image.width}
                      height={feature.image.height}
                      sizes="(min-width: 1024px) 560px, 100vw"
                      className="w-full"
                    />
                  </BrowserFrame>
                ) : (
                  <PhoneFrame>
                    <Image
                      src={feature.image.src}
                      alt={feature.image.alt}
                      width={feature.image.width}
                      height={feature.image.height}
                      sizes="300px"
                      className="w-full"
                    />
                  </PhoneFrame>
                )}
              </motion.div>
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="max-w-xl"
              >
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                  {feature.kicker}
                </p>
                <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                  {feature.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm sm:text-base">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/#demo-form"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Demo iste
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Lint + typecheck**

Run: `bun lint && bun typecheck` — Expected: hatasız.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/DeviceFrame.tsx src/components/sections/FeatureShowcaseSection.tsx
git commit -m "feat(landing): gerçek ekran görüntülü feature vitrin bantları"
```

---

### Task 7: StandOutSection (koyu ayrışma bandı)

**Files:**
- Create: `src/components/sections/StandOutSection.tsx`

**Interfaces:**
- Produces: `StandOutSection` named export, `id="neden"` (Header/Footer "Neden BakimX" çapası).

- [ ] **Step 1: Component'i yaz**

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ScanLine,
  Puzzle,
  Lock,
  Link2,
  Smartphone,
  Sparkles,
} from "lucide-react";

const differentiators = [
  {
    icon: ScanLine,
    title: "Ruhsatla saniyede kabul",
    description:
      "Ruhsat fotoğrafından araç, müşteri ve şasi bilgisi yapay zekayla otomatik dolar; elle veri girişi biter.",
  },
  {
    icon: Puzzle,
    title: "Araca uygun parça kataloğu",
    description:
      "Şasi numarası araç modeliyle eşleşir; iş emrine yalnız o araca uyan parçaları eklersiniz.",
  },
  {
    icon: Lock,
    title: "Değiştirilemez fotoğraf kanıtı",
    description:
      "Kabul fotoğrafları ve hasar haritası kilitlenir; 'bu çizik bende yoktu' tartışması kayıtla kapanır.",
  },
  {
    icon: Link2,
    title: "Müşteriye canlı takip linki",
    description:
      "Müşteri aracının durumunu kendi telefonundan izler; teklif ve çıktılar WhatsApp'tan gider.",
  },
  {
    icon: Smartphone,
    title: "Mobil öncelikli, kurulumsuz",
    description:
      "Masaüstü programı kurulumu yok; telefon, tablet veya bilgisayardan aynı gün çalışmaya başlarsınız.",
  },
  {
    icon: Sparkles,
    title: "AI servis danışmanı",
    description:
      "Premium'da yapay zeka danışmanı araç geçmişine göre işlem önerir, sorularınızı yanıtlar.",
  },
];

export function StandOutSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="neden" className="scroll-mt-24 bg-navy-light py-16 text-white sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Bizi diğer programlardan ayıran ne?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Klasik servis programları kayıt tutar. BakimX, işin sahada nasıl
            aktığını bilir: kamerayla kabul, kanıtla teslim, müşteriyle şeffaf
            iletişim.
          </p>
        </div>
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {differentiators.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              className="flex flex-col items-start"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-5 w-5 text-brand" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `bun lint && bun typecheck` — Expected: hatasız.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/StandOutSection.tsx
git commit -m "feat(landing): koyu 'bizi ayıran' ayrışma bandı (StandOutSection)"
```

---

### Task 8: BeforeAfterSection (Öncesi/Sonrası)

**Files:**
- Create: `src/components/sections/BeforeAfterSection.tsx`

**Interfaces:**
- Produces: `BeforeAfterSection` named export (testimonial slotunun dürüst ikamesi; içerik eski `WhyBakimxSection`'dan taşındı).

- [ ] **Step 1: Component'i yaz**

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";

const beforeItems = [
  "Kağıt formlar ve dağınık notlar",
  "WhatsApp'ta kaybolan fotoğraflar",
  "Excel'de elle takip",
  "Müşteriyle 'bu çizik var mıydı?' tartışması",
];

const afterItems = [
  "Tek panelde dijital iş emri",
  "Fotoğraf ve hasar kayıt altında, değiştirilemez",
  "Teklif, onay ve tahsilat otomatik akışta",
  "Kayıtlı müşteri onayı ve canlı takip linki",
];

export function BeforeAfterSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          Defterden panele geçin
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">
          Servislerin her gün yaşadığı dağınıklığın BakimX'teki karşılığı:
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="rounded-xl border bg-card p-6 sm:p-8"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Eski yöntem
            </h3>
            <ul className="mt-5 space-y-3.5">
              {beforeItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base text-muted-foreground">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive/60" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-xl border-2 border-primary/30 bg-card p-6 sm:p-8 shadow-lg shadow-primary/5"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              BakimX ile
            </h3>
            <ul className="mt-5 space-y-3.5">
              {afterItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `bun lint && bun typecheck` — Expected: hatasız.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/BeforeAfterSection.tsx
git commit -m "feat(landing): öncesi/sonrası bandı (BeforeAfterSection)"
```

---

### Task 9: FAQSection restyle + FinalCTASection

**Files:**
- Rewrite: `src/components/sections/FAQSection.tsx`
- Create: `src/components/sections/FinalCTASection.tsx`

**Interfaces:**
- Consumes: `FAQ_ITEMS` (`@/lib/faq-data` — değişmez), `Accordion*` (`@/components/ui/accordion`).
- Produces: `FAQSection` (id="sss" korunur), `FinalCTASection` named export'lar.

- [ ] **Step 1: FAQSection.tsx'i Deel iki-kolon düzenine geçir** (dosyanın tamamı değişir)

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/faq-data";

export function FAQSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="sss" className="scroll-mt-24 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">SSS</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              BakimX hakkında en çok sorulanlar. Aradığınızı bulamadıysanız
              demo talebinde sorunuzu iletebilirsiniz.
            </p>
          </motion.div>
          <div className="lg:col-span-2">
            <Accordion className="w-full">
              {FAQ_ITEMS.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                >
                  <AccordionItem value={`item-${index}`} className="rounded-lg border bg-card px-5 mb-3">
                    <AccordionTrigger className="py-4 text-left text-base font-medium">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: FinalCTASection.tsx'i yaz**

```tsx
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTASection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="bg-brand/10 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.h2
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
        >
          Servisinizi bugün dijitale taşıyın
        </motion.h2>
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Kurulum yok, taahhüt yok. Kart doğrulamasının ardından 7 günlük
          denemeniz anında başlar.
        </motion.p>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4"
        >
          <Link
            href="/register"
            className={buttonVariants({ size: "lg", className: "gap-2 px-8 text-base shadow-lg shadow-primary/25" })}
          >
            7 Gün Ücretsiz Dene
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/#demo-form"
            className={buttonVariants({ variant: "outline", size: "lg", className: "border-primary/30 px-8 text-base" })}
          >
            Demo İste
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Lint + typecheck**

Run: `bun lint && bun typecheck` — Expected: hatasız.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/FAQSection.tsx src/components/sections/FinalCTASection.tsx
git commit -m "feat(landing): iki-kolon SSS + son CTA bandı"
```

---

### Task 10: Assembly — page.tsx, Header/Footer çapaları, eski bölümlerin silinmesi

**Files:**
- Rewrite: `src/app/page.tsx`
- Modify: `src/components/sections/Header.tsx:11-18` (navItems)
- Modify: `src/components/sections/Footer.tsx:29-48` (footerLinks.product)
- Delete: `src/components/sections/TrustStrip.tsx`, `ModulesSection.tsx`, `HowItWorksSection.tsx`, `FeatureSpotlightSection.tsx`, `WhyBakimxSection.tsx`, `EarlyAccessCTASection.tsx`, `car-damage-illustration.tsx`

**Interfaces:**
- Consumes: Task 3-9'un tüm yeni section export'ları.

- [ ] **Step 1: page.tsx'i yeni sırayla yaz** (dosyanın tamamı)

```tsx
import { AnnouncementBar } from "@/components/sections/AnnouncementBar";
import { Header } from "@/components/sections/Header";
import { HeroSection } from "@/components/sections/HeroSection";
import { PillarsSection } from "@/components/sections/PillarsSection";
import { PartnersStrip } from "@/components/sections/PartnersStrip";
import { RuhsatDemoSection } from "@/components/sections/RuhsatDemoSection";
import { FeatureShowcaseSection } from "@/components/sections/FeatureShowcaseSection";
import { StandOutSection } from "@/components/sections/StandOutSection";
import { BeforeAfterSection } from "@/components/sections/BeforeAfterSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main>
        <HeroSection />
        <PillarsSection />
        <PartnersStrip />
        <RuhsatDemoSection />
        <FeatureShowcaseSection />
        <StandOutSection />
        <BeforeAfterSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Header navItems'ı güncelle**

`Header.tsx` içinde `navItems` dizisini şu hale getir (başka bir şey değişmez):

```tsx
const navItems = [
  { label: "Canlı Demo", href: "/#ruhsat-demo" },
  { label: "Özellikler", href: "/#ozellikler" },
  { label: "Neden BakimX", href: "/#neden" },
  { label: "SSS", href: "/#sss" },
  { label: "Fiyatlar", href: "/fiyatlar" },
];
```

- [ ] **Step 3: Footer ürün linklerini güncelle**

`Footer.tsx` içinde `footerLinks.product`'ı şu hale getir:

```tsx
  product: [
    { label: "Canlı Demo", href: "/#ruhsat-demo" },
    { label: "Özellikler", href: "/#ozellikler" },
    { label: "Neden BakimX", href: "/#neden" },
    { label: "SSS", href: "/#sss" },
    { label: "Fiyatlar", href: "/fiyatlar" },
  ],
```

- [ ] **Step 4: Eski bölümleri sil (önce import kontrolü)**

```bash
grep -rn "TrustStrip\|ModulesSection\|HowItWorksSection\|FeatureSpotlightSection\|WhyBakimxSection\|EarlyAccessCTASection\|CarDamageIllustration" src --include='*.tsx' --include='*.ts' | grep -v "src/components/sections/\(TrustStrip\|ModulesSection\|HowItWorksSection\|FeatureSpotlightSection\|WhyBakimxSection\|EarlyAccessCTASection\|car-damage-illustration\)"
```

Expected: çıktı YOK (plan yazılırken tek dış kullanım `page.tsx` idi ve Step 1'de kaldırıldı). Çıktı varsa silme — önce o kullanımı değerlendir. Temizse:

```bash
git rm src/components/sections/TrustStrip.tsx src/components/sections/ModulesSection.tsx src/components/sections/HowItWorksSection.tsx src/components/sections/FeatureSpotlightSection.tsx src/components/sections/WhyBakimxSection.tsx src/components/sections/EarlyAccessCTASection.tsx src/components/sections/car-damage-illustration.tsx
```

- [ ] **Step 5: Tam doğrulama**

Run: `bun lint && bun typecheck && bun test && bun run build`
Expected: hepsi hatasız; build `/` sayfasını üretir.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/page.tsx src/components/sections
git commit -m "feat(landing): Deel-tarzı sayfa assembly'si + eski bölümlerin kaldırılması"
```

---

### Task 11: Tarayıcı QA (INLINE — ana oturum, Playwright MCP gerekir)

> Bu task da ana oturumda çalıştırılır (dev server + görsel muhakeme).

**Files:**
- Modify: QA'da bulunan sorunlara göre ilgili section dosyaları (küçük düzeltmeler).

- [ ] **Step 1: Dev server + landing'i aç**

`bun dev` çalışıyor olmalı. Playwright: viewport 1280×900 → `http://localhost:3000/` → tam sayfa screenshot al, görsel olarak değerlendir (bant ritmi, kontrast, taşma).

- [ ] **Step 2: Masaüstü fonksiyonel kontrol**

- Header çapaları: Canlı Demo → #ruhsat-demo, Özellikler → #ozellikler, Neden BakimX → #neden, SSS → #sss scroll ediyor mu?
- Hero formu: boş submit → alan hataları görünüyor mu; geçerli veri ile submit → başarı kartı geliyor mu (dev DB'ye DemoRequest yazılır)?
- FAQ accordion açılıp kapanıyor mu?
- FinalCTA "Demo İste" → hero formuna scroll ediyor mu?

- [ ] **Step 3: Mobil kontrol**

Viewport 375×812 → sayfayı baştan sona gez: yatay taşma yok, form kullanılabilir, screenshot bantları düzgün diziliyor, koyu bantta metin okunur.

- [ ] **Step 4: Dark tema + asset kontrolü**

- `document.documentElement`'e tema geçişi uygulayıp (`next-themes` toggle'ı veya localStorage) dark modda hero highlight, partner logoları (AWS JPG beyaz kutu sorunu!) ve koyu bandı kontrol et; sorun varsa Task 5'teki nota göre düzelt.
- `curl -sI http://localhost:3000/landing/partners/mutlu.svg | head -1` → `HTTP/1.1 200` (middleware muafiyeti çalışıyor).

- [ ] **Step 5: Düzeltmeleri commit'le**

```bash
git add -A src/components/sections
git commit -m "fix(landing): QA düzeltmeleri (mobil/dark tema)"
```

(Düzeltme yoksa bu adım atlanır.)

---

## Manuel QA Özeti (kullanıcıya rapor edilecek)

- `/` masaüstü + mobil görünüm, hero form gönderimi (admin panelde Lead olarak düşer), çapa linkleri, dark tema, `/demo` sayfasının hâlâ çalıştığı (DemoRequestSection silinmedi).
- Riskler: screenshot'lar UI değişince eskir (tazeleme: Task 2 akışı); AWS JPG dark temada kutu görünebilir (QA'da yakalanır); prod'da `/landing/*` muafiyeti deploy sonrası `curl -I https://bakimx.com/landing/partners/mutlu.svg` ile doğrulanmalı.
