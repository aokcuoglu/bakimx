# BakimX Marka Kimliği Rehberi

> **Sürüm:** v1.0 · 2026-07-22
> **Kaynak:** Rakip marka analizi ([ari.app](https://ari.app/) + [Shopmonkey](https://www.shopmonkey.io/)), mevcut çekirdek korunup sistematize edildi.
> **Görsel pano (Artifact):** https://claude.ai/code/artifact/4acfd50e-8eb1-4fc5-a345-87e1bc40e038
> **Not:** Bu doküman mevcut markayı (lacivert + “traced X” + Geist) **değiştirmez**; dağınık kullanımı tek bir profesyonel sisteme oturtur. Kod tarafındaki kaynak: `src/app/globals.css` (renk token’ları), `src/components/shared/brand-logo.tsx` (logo API), `public/0{1..4}-bakimx-*.svg` (logo dosyaları).

---

## 1. Konumlanma & Strateji

### Marka özü
**“Oto servisin dürüst işletim sistemi.”** BakimX üç söz taşır: **hız, kanıt, dürüstlük.**

### Rakip marka okuması
| | Konum | Ana ikna | Marka hissi |
|---|---|---|---|
| **ari.app** | En ucuz / en geniş | Yorum sayısı, ödül duvarı, fiyat | Neşeli, kalabalık, ucuz |
| **Shopmonkey** | Premium / bütünleşik | “Binlerce dükkan”, sonuç-testimonial, world-class support | Kurumsal, güvenli, pahalı |
| **BakimX** | **Dürüst premium · yerel** | Ürün-içi gerçek kanıt (canlı ruhsat, değiştirilemez foto, canlı takip) | Güvenilir, net, saha-gerçekçi |

**Ayrışma:** Rakipler güveni *ödünç alır* (rozet, yorum, ödül). BakimX güveni **ürünün içinde gösterir** ve **hiçbir kanıtı uydurmaz**. Premium hisse fiyatla değil, **dürüstlük + yerel gerçeklikle** (Türkiye, KVKK, ruhsat/plaka) ulaşır.

### Marka kişiliği
**Dürüst · Net · Saha-gerçekçi · Sıcak-profesyonel · Yerel**

### Değer vaadi
> “Aracı saniyede kabul et, servisi kağıtsız ve kanıtlı yönet — abartısız.”

### Hedef kitle
Türkiye’deki oto servis işletmeleri; çoğunlukla mobil, saha odaklı, teknik ama karmaşık yazılıma zamanı olmayan usta/işletme sahibi.

---

## 2. Logo & Sembol

BakimX **only-logo**’dur (2026-07-09): sembol tek başına yeter, ayrı yazılı wordmark dosyası kullanılmaz. Metin içinde marka adı normal şekilde **“BakimX”** yazılır.

### Anlam
Sembol, “BakimX”in **X**’idir — üç koldan kurulur:
- **İki ileri mavi kol** → hareket ve hız (“saniyede kabul”). Gradyan `#2B72EE → #4F86FF`.
- **Bir lacivert kol** → zemin, güven, kalıcılık. (Koyu zeminde beyaz kola döner.)

### Varyantlar (dosyalar)
| Varyant | Zemin | Dosya |
|---|---|---|
| `primary-light` / `icon-light` | Açık | `/03-bakimx-icon-light.svg` (lacivert + mavi kol) |
| `primary-dark` / `icon-dark` | Koyu | `/04-bakimx-icon-dark.svg` (beyaz + mavi kol) |

Kod API’si: `<BrandLogo variant size clearSpace />` — `src/components/shared/brand-logo.tsx`.

### Kurallar
- **Açık alan (clear-space):** Çevrede en az bir **X-kol kalınlığı** (~%8) boşluk.
- **Minimum boyut:** **32px altında yalnızca ikon** (primary otomatik ikona düşer).
- **Yazım:** Her zaman **“BakimX”**. `Bakimx` / `BAKIMX` / `bakimx` **YASAK**.
- **Yanlış kullanım:** döndürme/eğme/esnetme, renk değiştirme, gölge/efekt ekleme, düşük kontrastlı zemin.
- SVG vektör; `next/image` ile `unoptimized` servis edilir (kök `.svg` middleware-muaf olmalı).

---

## 3. Renk Sistemi

Denge kuralı ≈ **%70 nötr · %22 lacivert · %8 sinyal mavisi**. Nötrler saf gri değil, **mavi-yanlı** seçilir. Sistem hem açık hem koyu temada token’larla çalışır; kontrast **AA** korunur.

### Çekirdek
| İsim | Rol | Hex | Token |
|---|---|---|---|
| Motor Laciverti | Zemin, koyu bantlar, ana metin | `#071F49` | `--color-navy` |
| Lacivert Derin | Hero/footer zemini (en koyu) | `#031432` | `--color-navy-light` |
| Sinyal Mavisi | Eylem, bağlantı, vurgu (**az kullan**) | `#2F84FF` | `--color-brand` |
| Logo gradyanı | Sembol kolları | `#2B72EE → #4F86FF` | (SVG) |

### Nötrler (açık tema)
| Rol | Değer (yaklaşık hex) | Token (oklch) |
|---|---|---|
| Kağıt (bg) | `#F3F6FB` | `--background: oklch(.98 .002 250)` |
| Yüzey | `#FFFFFF` | `--card` |
| Mürekkep (metin) | `#0E1F3C` | `--foreground: oklch(.20 .04 260)` |
| Yumuşak metin | `#45526C` | `--muted-foreground: oklch(.50 .02 260)` |

> Koyu tema token’ları `globals.css` `.dark` bloğunda tanımlıdır (`--background: oklch(.15 .05 260)`, `--primary: oklch(.63 .20 258)` vb.). Marka mavisi koyu temada bir tık parlar.

### Semantik (marka vurgusundan ayrı)
| İsim | Kullanım | Hex | Token |
|---|---|---|---|
| Onay Yeşili | Başarı, tamamlandı, onaylandı | `#12A150` | `--success` |
| WhatsApp | Yalnız WhatsApp paylaşım eylemleri | `#128C7E` | `--color-whatsapp` |
| Uyarı / Hata | Hata, silme, dikkat | `#E5484D` | `--destructive` |

---

## 4. Tipografi

- **Geist** (sans) — başlık + gövde. Geometrik-hümanist, sıcaklığı olan nötr sans. Sıkı harf aralığı (`letter-spacing` negatif), başlıklarda `text-wrap: balance`.
- **Geist Mono** — **veri sesi**: plaka, VIN, tutar, iş emri no, kod, mono etiketler. Bu markanın “gerçek/teknik veri” tonudur.
- Rakamlarda `font-variant-numeric: tabular-nums`.

### Ölçek (öneri)
| Rol | Boyut | Ağırlık |
|---|---|---|
| Display | clamp(40–76px) | 700 |
| Başlık (h1) | clamp(30–46px) | 700 |
| Alt başlık (h2) | 21–27px | 650 |
| Gövde | 15.5–16px | 400 |
| Etiket (mono) | 12px · `.14em` · UPPERCASE | 500–600 |

Örnek veri dizilimi (mono): `34 MYL 739` · `VIN WVWZZZ1KZ8W386752` · `İş Emri #1042 · ₺2.450,00`.

---

## 5. İkonografi & Görsel Dil

- **İkonlar:** `lucide` çizgi seti — 1.5–2px kontur, yuvarlak uç, dolgusuz, sade.
- **Ürün görseli:** her zaman **cihaz çerçevesinde** (tarayıcı/telefon) — ekran = kanıt. Bkz. `DeviceFrame.tsx` (`BrowserFrame`/`PhoneFrame`).
- **Fotoğraf:** gerçek atölyeden; stok/temsili değil. Demo/örnek veriler **“örnek · temsili”** etiketlenir.
- **Hareket:** amaca hizmet eden az animasyon (framer-motion); **her zaman `useReducedMotion` / `prefers-reduced-motion` saygısı**.
- **Spec-chip:** mono etiketli küçük teknik rozetler (plaka, durum) markanın imza dokusudur.

---

## 6. Ses & Ton

**Usta gibi konuş: net, dürüst, abartısız.** Kısa cümle, sade Türkçe, saha dili. Söz verirken abartma; ne olduğunu ve nasıl olacağını söyle. Gelecek özellik **“yakında / geliştiriliyor”** diye işaretlenir.

### Değişmez dürüstlük kuralları (pazarlık yok)
1. Asla **sahte istatistik, yorum sayısı, ödül veya temsili testimonial**.
2. Asla **parça-fiyatı veya AI-fiyat iddiası**; fiyat müşterinin kendi kataloğundan gelir.
3. Landing’de **fiyat tablosu yok** — fiyat yalnız `/fiyatlar`’da.
4. **Çalıştırılmayan destek kanalı** (telefon/WhatsApp hattı, “destek ekibi”) iddia edilmez. BakimX solo geliştirilir; gerçek olan e-posta desteğidir.

### Do / Don’t
| ✓ Böyle | ✕ Böyle değil |
|---|---|
| “Ruhsatı okutun, gerisini sistem doldursun.” | “Binlerce servisin #1 tercihi!” |
| “Kart doğrulaması sonrası 7 gün ücretsiz.” | “Tamamen ücretsiz, sınırsız her şey!” |
| “KVKK uyumlu olacak şekilde geliştiriliyor.” | “Tam KVKK sertifikalı.” (henüz değil) |

---

## 7. Sistem Uygulaması

- **Butonlar:** birincil = dolu sinyal mavisi (`h-9` web, `size=lg` ana CTA); ikincil = outline (koyu zeminde `border-white/25` şeffaf).
- **Rozet/chip:** yumuşak marka tini (`chip-b`), semantik durum rozetleri, mono spec-chip.
- **Kartlar:** `--surface` + `--line` kenarlık + ~16px radius.
- **Bantlar:** koyu (lacivert) ↔ açık ↔ tint ritmi; hero ve final CTA koyu lacivter “bookend”.
- **Hero sesi:** lacivert otorite + mavi vurgu + tek net vaat (“Aracı **saniyede** kabul edin, servisi **kağıtsız** yönetin”).

> Uygulama örnekleri ve tam görsel için marka panosuna (Artifact) bakın.

---

## Ekler / kaynak konumları
- Renk token’ları: `src/app/globals.css`
- Logo bileşeni & kurallar: `src/components/shared/brand-logo.tsx`
- Logo dosyaları: `public/03-bakimx-icon-light.svg`, `public/04-bakimx-icon-dark.svg`
- Cihaz çerçeveleri: `src/components/sections/DeviceFrame.tsx`
- Görsel pano kaynağı: `docs/brand/brand-board.html` (Geist gömülü, self-contained)
