# BakımX Landing Page — UI/UX Tasarım Denetimi

> **Kapsam:** `/` ana sayfa (13 bölüm) + paylaşılan bileşenler (`Header`, `Footer`, `DeviceFrame`, `SectionHeading`, `BrandEyebrow`, reveal/enter animasyon sistemi)
> **Bakış açısı:** Ürün tasarımcısı / UI-UX denetimi
> **Referans:** [docs/brand/2026-07-22-bakimx-marka-kimligi.md](./brand/2026-07-22-bakimx-marka-kimligi.md) · [docs/landing-performance.md](./landing-performance.md)
> **Tarih:** 2026-08-24

---

## 0. Yönetici Özeti

Landing, **disiplinli bir tasarım sisteminin** ürünü: token'lı renk paleti, ölçülmüş kontrast tonları (`-strong` ailesi), CSS-only hareket dili ve "dürüstlük" ilkesi kod seviyesinde korunuyor. Zayıf nokta sistem değil **uygulama tutarlılığı**: iki farklı bölüm-başlığı dili, iki farklı H2 ölçeği, arka arkaya iki özdeş kart ızgarası ve marka rehberindeki "lacivert bookend" ritminin uygulanmamış olması. Dönüşüm tarafında ise form erişilebilirliği ve sayfa sonu akışı (FinalCTA ↔ DemoForm sırası) düzeltilmesi gereken iki somut bulgu.

| Kategori | Puan /10 | Not |
|---|---|---|
| Görsel kimlik & marka uyumu | **7.5** | Spec-chip/mono dokusu güçlü; bookend ritmi ve eyebrow dili sapmış |
| Renk sistemi | **9** | Token disiplini örnek nitelikte |
| Tipografi | **6.5** | Ölçek çift dilli, `balance` yok, SectionHeading parçalı |
| Layout & ritim | **8** | py-16/sm-24 ritmi kusursuz; iki bölüm zeminsiz bitişiyor |
| Etkileşim tasarımı | **8.5** | Canlı ruhsat demosu sayfanın en iyisi |
| Erişilebilirlik | **7** | Kontrast/reduced-motion mükemmel; form & hamburger boşlukları var |
| Mobil UX | **8** | Snap şerit + safe-area bilinci iyi; hero yoğunluğu risk |
| Dönüşüm kurgusu | **7** | CTA ritmi tutarlı; sayfa sonu sıralaması tartışmalı |

---

## 1. Güçlü Yönler (korunmalı)

### 1.1 "Veri sesi" kimliği tutarlı şekilde taşıyor
Rehberin imza dokusu olan **mono spec-chip** dili landing'e gerçekten işlemiş: ruhsat alan kodları (`A`, `D.1`, `E`), plaka çipi (`font-mono`), `BrandEyebrow`'un `tracking-[0.18em]` uppercase mono etiketi, `PartnersStrip`'in mono alt başlığı. Bu, sayfaya "atölye/ölçüm" çağrışımını rakiplerin neşeli-ucuz dilinden farklı biçimde veriyor. **Sayfanın en tanınır görsel imzası bu; yeni bölüm eklerken bozulmamalı.**

### 1.2 Renk token disiplini örnek nitelikte
Tüm landing'de **tek bir hardcoded renk yok** (tek istisna: `DeviceFrame`'deki tarayıcı trafik ışıkları — bkz. §4.9). Semantik kullanım da doğru: BeforeAfter'da `XCircle → text-destructive-strong`, `CheckCircle → text-success-strong`; düşük güven vurgusunda `warning/10` zemin + `warning-strong` metin. `-strong` ton ailesinin (BAK-160, BAK-189) "tonlu zeminde metin" problemini çözme biçimi sektörde nadir görülebilir bir olgunluk.

### 1.3 Hareket dili performansla evlilik
framer-motion'ın sökülüp `.enter-up` / `.enter-pop` / `[data-reveal]` / `.ruhsat-scan-line` ile değiştirilmesi (BAK-165) yalnız bir optimizasyon değil, bir **tasarım ilkesi**: DOM değişmiyor, JS'siz doğru görünüyor, `prefers-reduced-motion` her katmanda saygılı. Özellikle objection şeridinin üç kurgulu çözümü (mobil snap / desktop sonsuz kayma / reduce'da statik grid) ve hover/focus-within'de durması WCAG 2.2.2'yi de karşılıyor.

### 1.4 CTA ritmi disiplinli
Primary **"7 Gün Ücretsiz Dene"** + secondary **"Demo İste"** çifti hero → ruhsat demo sonu → trust → final CTA'da aynı görsel ağırlıkla (dolu + shadow-lg shadow-primary/25 ↔ outline + border-primary/25) tekrarlanıyor. Ziyaretçi hiçbir ekranda "şimdi ne yapayım?" sorusuna yanıtını yitirmiyor. Takip olayları (`cta_location`) da her tekrarda ayrı işaretli.

### 1.5 Dürüstlük ilkesi kodda yaşyor
"Demo · örnek ruhsat", "örnek / temsili", sahte istatistik/testimonial yokluğu, fiyat tablosunun `/fiyatlar`'a bırakılması — rehberin "değişmez dürüstlük kuralları" bileşen yorumlarında ve içerikte fiilen uygulanıyor. Premium hissiyat abartı değil, kanıt diliyle kuruluyor; bu, konumlandırmanın tasarıma başarıyla tercümesidir.

---

## 2. Bulgu: Marka Rehberi ↔ Uygulama Sapmaları

### 2.1 "Lacivert bookend" ritmi uygulanmamış — Orta
Rehber §7: *"bantlar: koyu (lacivert) ↔ açık ↔ tint ritmi; **hero ve final CTA koyu lacivert 'bookend'**."*

Uygulama: Hero `bg-gradient-to-b from-brand/10` (açık), FinalCTA `bg-brand/10` (açık tint). Sayfada koyu lacivert yalnız **footer**'da (`bg-navy`). Sonuç:

- Sayfa açılışı "premium otorite" yerine "standart SaaS açılışı" hissediyor; rehberin hedeflediği Shopmonkey-karşıtı premium konum zayıflıyor.
- Footer'a lacivert tek başına kalınca "sonradan eklenmiş koyu bant" gibi duruyor, kitap uçları kapanmıyor.

**Öneri:** İki seçenek — (a) Hero'yu `navy-light` zemin + beyaz H1 + mavi vurguya taşıyıp canlı demo kartlarını koyu üzerinde parlatmak (en iddialı), (b) en azından FinalCTA'yı laciverte alıp footer'la bitişik koyu bir kapanış yapmak. (b) düşük riskli ilk adım.

### 2.2 İki farklı bölüm-başlığı dili — Orta
- `RuhsatDemoSection` → `SectionHeading`: **pill rozet** (`bg-primary/10 rounded-full`, `text-sm`) + highlight'lı başlık.
- Diğer tüm bölümler → `BrandEyebrow`: **mono uppercase çıplak etiket**, highlight yok.

Aynı sayfada iki "eyebrow" grameri var; üstelik SectionHeading'in rozeti rehberdeki mono "veri sesine" ait **değil** (o yumuşak chip dilidir). Paylaşılan bileşen varken beş bölümün elle başlık yazması ayrıca bakım maliyeti.

**Öneri:** `SectionHeading`'i `BrandEyebrow`'u içeren tek API'ye indirgeme (`badge` → mono eyebrow), highlight desteğini koru, tüm bölümlere geçir.

### 2.3 H2 ölçeği çift standartta — Düşük
| Desen | Boyut | Kullanan |
|---|---|---|
| A | `text-3xl sm:text-4xl` | FeatureShowcase, FAQ, (Hero H1 varyantı) |
| B | `text-2xl sm:text-3xl lg:text-4xl` | StandOut, Segments, BeforeAfter, Trust, DemoForm, FinalCTA |

Aynı görünümde (lg) eşitleniyorlar ama tablet ara kırılımında sayfa "zıplıyor". Tek desene bağlanmalı — ideal olarak SectionHeading içinde.

### 2.4 Rehberdeki tipografi detayları eksik — Düşük
Rehber: sıkı harf aralığı ✓ (`tracking-tight` var), **`text-wrap: balance` ✗** (hiçbir başlıkta yok — Türkçede uzun başlıkların son kelimesi tek başına satıra düşüyor), Display ölçeği clamp(40–76px) iken H1 maksimum 48px — iddialı bir display boyutu denenmemiş. Bookend kararıyla birlikte H1'i büyütme denemesi yapılabilir.

---

## 3. Bulgu: Kompozisyon & Ritim

### 3.1 Arka arkaya iki özdeş kart ızgarası — Orta
`StandOutSection` (6 kart, 3 kolon) hemen ardından `SegmentsSection` (6 kart, 3 kolon) geliyor. Kart anatomisi **birebir aynı**: `h-11 w-11 rounded-lg bg-brand/10` ikon kutusu + `text-base font-semibold` başlık + `text-sm text-muted-foreground` açıklama. Yalnız zemin ters (`muted/30` ↔ `background`). Kaydırma deneyiminde bu iki bölüm tek bir uzun "aynı kart duvarı" olarak algılanıyor; ikisinin mesajı da farklıyken (ayırt edicilik ↔ hedef kitle) görsel olarak ayırt edilmiyor.

**Öneri:** Segments'i karttan indir — 2 kolonlu kompakt **satır listesi** (ikon + tek satır başlık, açıklama hover/title'da) veya çip bulutu yeterli; "kimler için" bilgisi karar değil, doğrulama içeridir. Böylece StandOut'un kartları da nefes alır.

### 3.2 FAQ → DemoForm zeminsiz bitişiyor — Düşük
Bölüm zemin ritmi: `brand/10 → bg → muted/30 → bg → muted/30 → bg → brand/10 → bg → bg ← ← brand/10`. FAQ ile DemoForm ikisi de `bg-background`; aralarında hiçbir çizgi/zemin değişimi yok. DemoForm'un kartı (`shadow-xl`) tek başına sınır kuruyor ama bölüm geçişi kayıyor.

**Öneri:** DemoForm'u `bg-muted/30`'a almak (BeforeAfter ile ritmi de tamamlar) ya da FAQ'a ince `border-b` eklemek.

### 3.3 Hero bilgi yoğunluğu — Orta (mobil)
Mobil hero'da üst üste: duyuru barı + header + rozet + H1 + paragraf + 2 CTA + "örneği aşağıda dene" linki + 3'lü trust badge + ask bar + 4 çip + yatay kart şeridi. **Sekiz farklı içerik türü** ilk ~2.5 ekranda. Her biri kendi başına gerekli; toplamı ise ilk CTA ile kart şeridi arasındaki mesafeyi açıyor.

**Öneri:** Mobilde trust badge satırını ask bar'ın altına (kart şeridinden önce değil sonra) taşımak ya da hero'dan tamamen çıkarmak — zaten DemoForm'un tepesinde birebir aynı üçlü tekrar ediyor (§3.4). Ayrıca "Örnek bir ruhsatı hemen aşağıda deneyin" linki ile ask bar çipleri aynı işi yapan iki giriş; mobilde tekiline düşürülebilir.

### 3.4 Trust badge üçlüsünün birebir tekrarı — Bilgi
`ShieldCheck/KVKK · Zap/Kurulumsuz · CalendarCheck/7 gün` seti HeroSection'da ve HeroLeadForm'un başlığının üstünde **aynen** duruyor. Form bağlamında tekrar güven verir (bilinçli olabilir); hero'dakilerle formdakilerin görsel ağırlığı farklı olduğu için hata gibi algılanmıyor. Dokümanlara not düşülsün: bilinçli tekrar.

### 3.5 FinalCTA ↔ DemoForm sırası dönüşümü zorluyor — Orta
Sayfa sonu: `FAQ → DemoForm → FinalCTA`. FinalCTA'nın secondary butonu `/#demo-form`'a **yukarı geri** kaydırıyor. En dipteki kullanıcı "Demo İste" dediğinde form bir ekran yukarıda kalıyor; geri kaydırma, dönüşümün en kritik anında sürtünme.

**Öneri:** (a) FinalCTA'yı DemoForm'un altına alıp koyu bookend olarak sayfayı kapatmak (§2.1 ile birleşir), ya da (b) FinalCTA'yı kaldırıp DemoForm'u güçlendirmek. Mevcut düzen savunulabilir ama (a) açıkça daha akıcı.

### 3.6 PartnersStrip iki logo ile zayıf — Orta
"Güçlü iş ortakları ve altyapıyla çalışıyoruz" başlıklı bir şeritte **iki** logo (Mutlu Akü, AWS Startups) var. Sosyal kanıt matematiği tersine çalışıyor: az logo, az ortak okur. Ayrıca light temada mobilde hover olmadığından logolar **hep %60 opak gri** kalıyor — "soluk, yarım bırakılmış" hissi.

**Öneri:** Logo sayısı 4-6'ya çıkana kadar bölümü ya tamamen kaldır ya da tek satırlık, başlıksız minik bir referans satırına ("Mutlu Akü ve AWS Startups Startups programı destekliyor" gibi) dönüştür. Hover'a bağımlı renklenmeyi `motion-safe`/pointer medya sorgusuyla sınırla veya light temada da tam renk ver.

---

## 4. Bulgu: Bileşen Detayları

### 4.1 Header hamburger `aria-expanded` yok — P1 a11y
`Header.tsx`'te menü düğmesi `aria-label` taşıyor ama `aria-expanded={mobileOpen}` ve `aria-controls` yok; ekran okuycu menünün açık/kapalı olduğunu duyamaz. Panel de state-koşullu render — Radix `Collapsible`/`Sheet` bu bedaveleri verirdi. *(AGENTS.md kuralı gereği raw toggle yerine bileşen tercih edilmeli.)*

### 4.2 HeroLeadForm hata/başarı erişilebilirliği — P1 a11y
- Alan hataları `<p className="text-xs text-destructive-strong">` olarak basılıyor ama Input'a `aria-invalid`, hataya `aria-describedby` bağlantısı yok; ekran okuycu hatayı **duymaz**.
- `_general` hatası `role="alert"`/`aria-live` olmadan ekleniyor.
- Başarı kartına geçişte odak yönetimi yok — form DOM'dan kalkıyor, odak `<body>`ye düşüyor; "Talebiniz alındı!" duyurulmuyor.
- Not: useState-tabanlı form, AGENTS.md'nin RHF+zod kuralından sapar; landing bundle'ını küçük tutma gerekçesi makul, ama kural istisnası dokümante edilmeli.

**Öneri:** `aria-invalid` + `id`/`aria-describedby` çifti, `_general`'a `role="alert"`, başarı kartına `tabIndex={-1}` + `focus()` + `role="status"`.

### 4.3 FAQ'ta iki soru grubu ayırt edilmiyor — Düşük
Liste = 8 itiraz-cevap (tırnak içinde, `objections.ts`ten) + genel SSS. Editoryal olarak zekice (tırnak işareti = müşteri sesi) ama görsel olarak **grup ayrımı yok**: kullanıcı neden bazı soruların tırnaklı olduğunu bilmuyor. İtiraz bloğundan sonra ince bir `BrandEyebrow` ("Diğer sık sorulanlar") ya da grup arası `Separator` yeterli.

### 4.4 ObjectionCards şeridi — sağlam, iki minik not
Desktop sonsuz kayma + kenar maskesi + hover/focus durdurma iyi kurgu. Notlar: (1) 72s tur süresi hızlı okuyan için bile yeterince yavaş — sorun yok; (2) kart içindeki ekran görüntüsü kartın en büyük öğesi ve `sizes="384px"` — retina'da 1760px kaynak iniyor, doğru; (3) şerit `height: 34rem` sabit — çok uzun cevaplı yeni kart eklenirse kesilir; kart metin uzunluğuna üst sınır (editoryal kural) konulmalı.

### 4.5 Ask bar pill dili yalnız hero'da — Bilgi
`rounded-full` input+buton+çipler sayfada tek yerde pill grameri kullanıyor (diğer her şey `rounded-xl`). Sohbet/arama çağrışımı olarak savunulabilir ve asistan FAB'ıyla akraba; bilinçli karar olarak belgelemek yeterli.

### 4.6 RuhsatDemoSection — sayfanın en iyi bölümü
İki panelli "aha anı": solda stilize belge + tarama çizgisi, sağda alan-alan dolum + VIN parça çipleri + düşük-güven "düzelt" rozeti + dürüst dipnot. Reduced-motion'da anında sonuç, `phase === "done"` CTA'sı etkileşimin hemen ardından. Eleştirilecek yanı yok denecek kadar az: `FieldCell`'deki `opacity: 0.35` inline stil, theme-tokens testinin `opacity-*` kapısından kaçıyor (inline style) — kural ruhu gereği orada da `shown ? "" : "opacity-35"` yerine skeleton yaklaşımı zaten var, tutarlı. Tek öneri: tarama bittiğinde sol belgedeki satırların da "okundu" duruma geçmesi (şu an yalnız sağ panel dolar) — göz solda bekliyor.

### 4.7 BeforeAfter — doğru semantik, doğru hiyerarşi
`destructive-strong`/`success-strong` ikonları, BakımX kartında `border-2 border-primary/30 + shadow-lg` ile ağırlık farkı. Kurgusal olarak da "Eski yöntem" başlığı nötr tutulmuş ("kötü yöntem" demiyor) — tonlama rehbere uygun. Dokunulmamalı.

### 4.8 TrustOnboarding numara daireleri — minik not
`bg-primary` dolu daire içindeki rakamlar `text-primary-foreground` — kontrast ölçülmüş. Adımların arasına bağlayıcı bir çizgi (desktop'ta step connector) akış okumasını güçlendirirdi; şart değil.

### 4.9 DeviceFrame trafik ışıkları ham palette — Bilgi
`bg-red-400/80 · bg-yellow-400/80 · bg-green-400/80` — macOS pencere metaforu için dekoratif, metin taşımıyor, kontrast kuralı kapsamı dışı. Yine de token disiplininin tek deliği; `chart-*` ya da `success/warning/destructive` türevine bağlanabilir. PhoneFrame'in `border-foreground/80` çerçevesi koyu temada da çalışıyor — iyi.

---

## 5. Öncelikli Aksiyon Listesi

| # | Aksiyon | Etki | Maliyet | Bölüm |
|---|---|---|---|---|
| 1 | Form a11y paketi: `aria-invalid` + `aria-describedby`, `role="alert"`, başarıda odak yönetimi | a11y/dönüşüm | S | 4.2 |
| 2 | Hamburger'e `aria-expanded`/`aria-controls` (veya Collapsible'a taşı) | a11y | XS | 4.1 |
| 3 | FinalCTA'yı DemoForm altına al + lacivert bookend ile kapat | dönüşüm+marka | S | 3.5, 2.1 |
| 4 | SectionHeading'i tek eyebrow diline bağla; H2 ölçeğini tekilleştir | tutarlılık | M | 2.2, 2.3 |
| 5 | Segments'i kart ızgarasından kompakt listeye indir | ritim | S | 3.1 |
| 6 | FAQ grup ayrımı (eyebrow/Separator) | netlik | XS | 4.3 |
| 7 | DemoForm zeminini `bg-muted/30` yap | ritim | XS | 3.2 |
| 8 | PartnersStrip'i yeniden konumlandır (≤2 logo kuralı) | güven algısı | S | 3.6 |
| 9 | Hero mobil yoğunluğu: badge satırını/mini linki sadeleştir | mobil | S | 3.3 |
| 10 | Başlıklara `text-wrap: balance` | tipografi | XS | 2.4 |

*(XS < 30dk, S < 2sa, M yarım gün ölçeği.)*

## 6. Sonuç

Bu landing'in en değerli varlığı **sistemin kendisi**: kontrastı ölçülmüş token'lar, JS'siz hareket, dürüstlük kuralları ve mono "veri sesi". Tespitlerin tamamı bu sistemin *kullanım tutarsızlıkları* — yeni bir sistem icrası değil, mevcut olanın her yere eşitlenmesi meselesi. 1-2. sıradaki a11y düzeltmeleri ve 3. sıradaki kapanış ritmi, en yüksek getirili üç hamledir.
