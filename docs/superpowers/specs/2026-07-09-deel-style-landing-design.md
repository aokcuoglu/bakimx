# Deel-Tarzı Landing Page Yeniden Tasarımı — Design Spec

**Tarih:** 2026-07-09
**Durum:** Onaylandı (kullanıcı, brainstorming oturumu)
**Kapsam:** `bakimx.com` kök landing page (`src/app/page.tsx` + `src/components/sections/*`)

## Amaç

Mevcut landing page'i Deel.com'un landing yapısını referans alarak profesyonel bir kurumsal SaaS sayfasına dönüştürmek. Kullanıcının özellikle istediği dört öge:

1. Uygulamadan **gerçek ekran görüntüleri** (mockup çerçeve içinde; ileride video ile değişebilir).
2. Hero başlığında **highlight/markup vurguları** (Deel'in beyaz kutu-highlight imzası).
3. **Rakiplerden ayrışma** bölümü (Deel'in koyu "How we stand out" bandı).
4. **Referans/ortak logoları** şeridi: Mutlu Akü + AWS Startups.

## Bağlayıcı kararlar (kullanıcı onaylı)

| Karar | Seçim |
|---|---|
| Hero sağ taraf | Deel gibi **lead formu** (mockup değil) |
| Logo şeridi çerçevesi | **"Güçlü iş ortakları ve altyapıyla çalışıyoruz"** — "Trusted by / müşterimiz" iddiası YOK (AWS müşteri değil; dürüst konumlama kuralı) |
| Uygulama görselleri | **Gerçek ekran görüntüleri** — Playwright ile local demo hesabından çekilir |
| Canlı ruhsat OCR demo section | **Korunur**, yeni görsel dile uyarlanır |
| Kapsam | **Tam Deel-yapısı yeniden tasarım** (hibrit değil) |
| Testimonial | Gerçek müşteri alıntısı yok → **sahte quote koyulmaz**; slota mevcut Öncesi/Sonrası karşılaştırması gelir |

## Görsel dil

- Deel sayfa ritmi BakimX paletine çevrilir: **açık mavi (brand-tint) hero bandı** → beyaz içerik → **koyu lacivert (navy) ayrışma bandı** → açık SSS → **koyu footer**.
- Mevcut Tailwind token'ları kullanılır (`brand`, `navy`, `primary` vb.). Yeni renk sistemi icat edilmez.
- **Highlight markup:** hero başlığındaki kritik kelimeler beyaz kutu-highlight ile işaretlenir (`<mark>` benzeri stil, `bg-white`/`bg-card` + padding + hafif rotate yok — düz Deel stili).
- Marka kuralı: **only-logo** (traced X ikonu); hiçbir yüzeyde "BakimX" wordmark görseli kullanılmaz, metin olarak yazılır.
- Animasyon: mevcut `framer-motion` + `useReducedMotion` deseni korunur; abartısız fade/slide-in.
- Mobil öncelik: her bant önce mobil düzen; hero formu mobilde başlığın altına iner.

## Sayfa akışı (9 bölüm)

### 1. Hero (açık mavi zemin)
- **Sol:** highlight'lı H1 — *"Aracı **saniyede** kabul edin, servisi **kağıtsız** yönetin"* (highlight'lı kelimeler: "saniyede", "kağıtsız"; metin implementasyonda ince ayar görebilir). Altında kısa paragraf + 3 tikli değer maddesi (ruhsat OCR, tek ekran operasyon, WhatsApp/müşteri takibi) + "Nasıl çalışır" çapa linki.
- **Sağ (kart):** lead formu — alanlar: **Ad Soyad, Telefon, Servis adı, İl**. Mevcut **`/api/demo-request`** endpoint'ine POST eder (yeni endpoint yazılmaz; alan uyumu implementasyonda kontrol edilir, gerekiyorsa endpoint geriye-uyumlu genişletilir). Form altı: KVKK onay metni + gizlilik linki.
- Form kartının üstünde G2-benzeri puan YOK (puanımız yok); yerine "KVKK uyumlu · Kurulumsuz · 7 gün ücretsiz" güven rozetleri.
- Formun altında ikincil CTA: "7 Gün Ücretsiz Dene" → `/register`.

### 2. Üçlü kart bandı (açık mavi zemin devamı)
Başlık: *"Servisinizin dijital operasyon merkezi"*. Üç kart, her birinde Deel'deki gibi mini UI vinyeti (JSX ile çizilmiş küçük kart görselleri):
1. **Ruhsat OCR** — saniyede araç + müşteri kaydı.
2. **İş emri + fotoğraf kanıtı** — değiştirilemez kanıt, hasar haritası.
3. **Müşteri iletişimi** — canlı takip linki + WhatsApp çıktısı.

### 3. Logo şeridi
- Başlık (küçük, uppercase): *"GÜÇLÜ İŞ ORTAKLARI VE ALTYAPIYLA ÇALIŞIYORUZ"*.
- Logolar: **Mutlu Akü** (`mutlu.com.tr/images/logo.svg`) + **AWS Startups** — `public/landing/partners/` altında **self-host** edilir (hotlink yok). Gri/soluk tonda, hover'da tam renk.
- Logo sayısı azken şerit ortalanır; ileride müşteri logoları eklenince başlık "Bize güvenen servisler"e evrilebilir (bu spec'in kapsamı dışı).

### 4. Canlı ruhsat OCR demosu
Mevcut `RuhsatDemoSection` işlevsel olarak aynen kalır; kart stili, başlık tipografisi ve zemin yeni görsel dile uyarlanır.

### 5. Dönüşümlü feature bantları (2-3 adet, beyaz zemin)
Deel'in sol-görsel/sağ-metin dönüşümlü bantları. Görseller **gerçek ekran görüntüleri**, CSS tarayıcı/telefon çerçevesi içinde:
- **(a) İş emri detayı** — fotoğraf checklist + işlem geçmişi (desktop çerçeve).
- **(b) Araca uygun parça** — VIN→TecDoc katalog seçici (desktop çerçeve).
- **(c) Müşteri public takip sayfası** — telefon çerçevesi (mobil görünüm).
Her bantta: kicker + başlık + paragraf + 2-3 tikli madde + "Demo iste" text-link.

### 6. Koyu lacivert "Bizi diğerlerinden ayıran" bandı
Deel'in dark section'ı. Başlık: *"Bizi diğer programlardan ayıran ne?"*. 6 ikon-kart (3×2 grid, mobilde tek kolon) — **hepsi gerçekten var olan özellikler**:
1. Ruhsat OCR ile saniyede araç kabul (AI görüntü işleme).
2. VIN'den araca uygun parça kataloğu.
3. Değiştirilemez fotoğraf kanıtı + hasar haritası.
4. Müşteriye canlı servis takip linki + WhatsApp/PDF çıktısı.
5. Mobil öncelikli ve kurulumsuz (eski masaüstü programların aksine).
6. AI servis danışmanı (Premium).

**Dürüstlük sınırı:** parça-fiyat karşılaştırma / AI fiyat kıyas gibi VAR OLMAYAN özellikler asla yazılmaz.

### 7. Öncesi/Sonrası bandı
Deel'deki testimonial slotu. Gerçek müşteri alıntısı olmadığından quote yok; mevcut `WhyBakimxSection`'ın "Kağıt formlar → Tek panelde dijital iş emri" öncesi/sonrası karşılaştırması bu slota, yeni görsel dille taşınır.

### 8. SSS
Mevcut **`faq-data.ts` tek kaynağından** beslenir; Deel'in geniş accordion görünümüne uyarlanır (sol başlık "SSS", sağ accordion listesi).

### 9. Son CTA + koyu footer
- Son CTA bandı: kısa başlık + "7 Gün Ücretsiz Dene" (`/register`) + "Demo İste" (form çapasına scroll).
- Footer navy zemine alınır (mevcut link yapısı korunur).

## Teknik plan

### Dosyalar
- `src/app/page.tsx` — yeni bölüm sırası.
- `src/components/sections/` — bölümler yeniden yazılır/revize edilir. `Header`, `AnnouncementBar` korunur (hafif restyle). `faq-data.ts` içerik kaynağı olarak aynen kalır.
- `public/landing/partners/` — self-host logo dosyaları.
- `public/landing/screens/` — optimize edilmiş ekran görüntüleri (WebP tercih).

### Ekran görüntüsü üretimi
1. OrbStack local DB + dev server ayağa kaldırılır (`docker compose -f docker-compose.local.yml up -d`).
2. Demo hesabıyla (seed, premium) Playwright ile giriş yapılır.
3. Çekilecek ekranlar: iş emri detayı (desktop), parça katalog seçici (desktop), public takip sayfası (mobil viewport).
4. Görüntülerde **gerçek kişi verisi olmadığı** kontrol edilir (demo/seed verisi olmalı).
5. WebP'e optimize edilir, `next/image` ile lazy servis edilir.

### Riskler ve kontroller
1. **Middleware muafiyeti:** `public/landing/*` yollarının middleware'den geçtiği/muaf olduğu doğrulanmalı (kök .svg/.png muafiyet dersi: auth-gate prod'da logo kırmıştı).
2. **Görsel ağırlığı:** WebP + lazy load + uygun `sizes`; hero LCP'ye ekran görüntüsü koymuyoruz (form var), LCP metin/form olur.
3. **Screenshot eskimesi:** UI değişince görseller eskir — bilinçli kabul; tazeleme adımı yukarıdaki üretim akışıyla tekrarlanabilir.
4. **Form uyumu:** `/api/demo-request` alan şeması hero formuyla eşleşmeli; sunucu tarafı validasyon korunur.
5. **Şema değişikliği YOK**, migration YOK. Salt UI + statik asset işi.

### Doğrulama
- `bun lint`, `bun typecheck` (veya repo'daki eşdeğer script'ler), `bun run build`.
- Mobil (375px) + desktop (1280px) manuel QA: hero form gönderimi, ruhsat demo, accordion, çapa linkleri, dark band kontrast (WCAG AA).
- Light/dark tema kontrolü (landing tema token'ları kullanıyor).

## Kapsam dışı
- Video/animasyonlu ürün turu (ileride).
- Gerçek müşteri testimonial'ları ve logoları (gelince 3. ve 7. bölüm evrilir).
- `/fiyatlar`, `/demo` sayfalarının yeniden tasarımı.
- Yeni backend endpoint'i veya şema değişikliği.
