# Premium 404 Sayfası — Tasarım

**Tarih:** 2026-06-25
**Durum:** Onaylandı (kullanıcı brainstorming'de onayladı)

## Problem

Şu an global bir `not-found.tsx` yok; eşleşmeyen tüm yollar Next.js'in standart
"404 — This page could not be found." sayfasını gösteriyor. Bu, premium/kurumsal
otomotiv SaaS marka hissiyle uyumsuz.

(Yalnızca `src/app/s/[token]/not-found.tsx` var — public token sayfasına özel,
dokunulmayacak.)

## Hedef

Global, oto temalı sıcak metaforlu, marka ile tutarlı tek bir premium 404 sayfası.

## Karar Özeti

- **Konsept:** A — oto temalı sıcak metafor ("Sayfa rotadan çıkmış").
- **Kapsam:** Tek evrensel sayfa (bağlam-duyarlı değil). Her zaman ana sayfaya
  yönlendirir + geri dön seçeneği.
- **Animasyon:** Saf CSS (`tw-animate-css` → `animate-in fade-in
  slide-in-from-bottom-*`). framer-motion YOK — hata sayfası hafif kalmalı.

## Dosya

`src/app/not-found.tsx` — Next.js bunu otomatik olarak standart 404'ün yerine
koyar (App Router global not-found convention).

## Yapı

- Client component (`"use client"`) — "Geri dön" butonu `router.back()` kullanır.
- Layout: `min-h-screen bg-muted`, ortalanmış kart (`s/[token]/not-found.tsx`
  deseniyle tutarlı: `bg-card border border-border rounded-xl p-8 shadow-sm`).
- **Görsel:** `BrandSpinner` (mevcut çift dişli, marka mavisi/navy, dekoratif)
  + üzerine "404" rozeti/etiket.
- **Başlık (h1):** "Sayfa rotadan çıkmış" — `text-foreground` bold.
- **Açıklama:** "Aradığınız sayfa taşınmış, silinmiş ya da hiç var olmamış
  olabilir. Sizi tekrar yola çıkaralım." — `text-muted-foreground`.
- **CTA'lar:**
  - Birincil: "Ana sayfaya dön" → `Link href="/"` +
    `buttonVariants({ size: "xl" })` (mevcut desen, register-form.tsx).
  - İkincil: "Geri dön" → `router.back()`, `Button variant="outline"`.
- **Alt bilgi:** `BrandLogo` (icon variant) + ince
  "BakimX — Dijital Araç Kabul Platformu" satırı.
- **Giriş animasyonu:** kart `animate-in fade-in slide-in-from-bottom-4
  duration-700` (reduced-motion'da tw-animate-css otomatik saygılı).

## Yeniden Kullanılan Bileşenler

- `BrandSpinner` (`src/components/shared/brand-spinner.tsx`)
- `BrandLogo` (`src/components/shared/brand-logo.tsx`)
- `Button` / `buttonVariants` (`src/components/ui/button.tsx`)

## Kapsam Dışı (YAGNI)

- Bağlam-duyarlı yönlendirme (auth durumuna göre panel/landing).
- framer-motion animasyonları.
- Özel illüstrasyon/SVG (mevcut dişli motifi yeterli).

## Riskler

- Düşük. Tek yeni dosya, şema/veri/tenant yok.
- Client component olduğu için `metadata` export edilemez — `<title>` layout'tan
  miras alınır (kabul edilebilir).

## Manuel QA

1. `/olmayan-bir-sayfa` → premium 404 görünmeli.
2. "Ana sayfaya dön" → `/`; "Geri dön" → önceki sayfa.
3. Mobilde ortalama/taşma kontrolü.
4. `prefers-reduced-motion` ile giriş animasyonu kapanmalı.
