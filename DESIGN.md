# BakımX — Attio temelli tasarım dili

## Kapsam

12 Eylül 2026 tarihli kullanıcı geri bildirimleri önceki iki bölümlük denemenin yerini alır. Referans kullanıcının Attio ekran görüntüleri ve https://attio.com/. Ana sayfanın tamamı, üç ürün tanıtım sayfası, karşılaştırma, iki rehber, blog (liste + yazı), fiyatlar, demo, sistem durumu ve dört hukuki belge ortak `PublicSite` görünümünü kullanır. 13 Eylül 2026 tarihli kullanıcı kararıyla bu görsel dil yeni ve revize edilen bütün ekranlar için esastır: public site, kimlik doğrulama, kurulum, uygulama ve yönetim. Ekranın işlevi içerik yoğunluğunu belirler; pazarlama sayfasının büyük başlıkları ve geniş boşlukları veri ekranlarına taşınmaz. Public tasarımın yerel yönü kullanıcı tarafından onaylandı. Güncel revizyon kayıt ve üyelik sonrası kurulum ekranlarını kapsar. Production yayını kapsam dışıdır.

## Referanslar ve karar geçmişi

12 Eylül 2026 oturumlarında önce Cal.com değerlendirilmiş, ardından Attio görselleri ana referans olarak seçilmiştir. Kullanıcı aynı gün Attio çalışmasını desteklemek üzere Vercel + Linear uyarlamasını onaylamıştır. 13 Eylül talebi bu dilin sonraki tüm geliştirmelerde kullanılmasını kesinleştirir.

- Ana görsel referans: [Attio](https://attio.com/) ve kullanıcının paylaştığı görseller.
- [Vercel DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/vercel/DESIGN.md): açık yüzey katmanları, ince sınırlar, sınırlı gölge.
- [Linear DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md): tipografi, boşluk ve yoğunluk disiplini, kontrollü vurgu.

Koleksiyondaki dosyalar üçüncü taraf tasarım analizleridir. BakımX'e uyarlanan kurallar bu belgededir; yabancı marka renkleri, fontları, koyu pazarlama yüzeyleri veya dekoratif gradientler doğrudan aktarılmaz. Mevcut shadcn/Radix ve erişilebilirlik kuralları geçerlidir.

## Görsel dil

Inter uygulama ve genel public yüzeylerde kullanılır. Kod ve sabit genişlikli alanlarda Geist Mono korunur. Blog (`/blog`) Clutch’a yakın display tipografi için **Switzer** kullanır (PP Radio Grotesk referansına yakın Fontshare alternatifi; ITF FFL, yerel WOFF2 dosyaları). Beyaz `card` zemin; ince `border` ayraçlar; koyu `foreground` başlıklar; `muted-foreground` açıklamalar. Mavi, ürün verilerinde ve bağlantılarda vurgu olarak kalır. Büyük renk blokları açık yüzeylere dönüştürülür. Ortak içerik sınırı 1200px, ürün sahnesi 1440px. Bölüm boşlukları masaüstünde 64–120px, mobilde 64px. Ana H1 84px'e, tanıtım sayfaları 76px'e kadar ölçeklenir. Başlıklarda sıkı harf aralığı ve dengeli satır kırılması kullanılır. Rehber ve hukuki metinlerin içerikleri korunur.

`PublicSite` ve CSS Module yalnız açıkça sarılmış site sayfalarına uygulanır. Uygulamanın global tokenları veya paylaşılan UI bileşenlerinin varsayılanları değiştirilmez. Header/Footer ortak açık görünüm kullanır. Mobil ürün görselleri dikey sıralanır; CTA'lar dar alanda alt alta gelir.

## Site genelinde metin rengi — 13 Eylül 2026

Kullanıcının Header için onayladığı koyu metin kararı tüm siteye genişletildi: public, blog, kayıt, kurulum, uygulama ve yönetim. Yukarıdaki Vercel ve Linear analizleri yeniden incelendi. Vercel'in nötr `#171717` ana metni ve açık yüzeyleri; Linear'ın kontrollü vurgu, sıkı başlık aralığı ve boyut/ağırlık/boşluk hiyerarşisi esas alınır. Linear'ın koyu pazarlama paleti taşınmaz.

- Açık temada ana metin, başlık, navigasyon ve alan etiketleri `text-foreground` kullanır: `#171717`. Kart, popover, secondary ve accent metinleri aynı nötr siyah tonundadır.
- Yardımcı metinler `text-muted-foreground` kullanır: `#262626`; soluk gri görünüm yerine siyaha yakın okunaklı ton. Tonlu yüzeylerde `text-muted-foreground-strong` (`#171717`) kullanılır.
- Hiyerarşi öncelikle font boyutu, ağırlık, satır yüksekliği ve boşlukla kurulur; metne opacity verilmez. Menü etiketleri yardımcı metin sayılmaz.
- Bu açık kullanıcı talebi, global tokenları değiştirmeme kuralının **nötr metin paleti için istisnasıdır**; renkler `globals.css` üzerinden uygulanır. Call-site'larda sabit hex renk kullanılmaz.
- Koyu tema açık metinlerini, koyu dolgu üzerindeki açık yazılar kendi foreground eşlerini korur. Marka, bağlantı, odak, başarı/uyarı/hata renklerinin anlamı korunur.
- Inter genel fonttur; `/blog` ve yazı sayfalarında Switzer, sabit genişlikli alanlarda Geist Mono korunur.

## Eylemler ve butonlar (zorunlu)

Bu bölüm 13–14 Eylül 2026 geri bildirimlerinin kalıcı kaydıdır. Yeni veya revize edilen her UI yüzeyinde (public, asistan, kayıt, kurulum, uygulama) uygulanır. Amaç: parlak mavi “chatbot/CTA” görünümünü tekrar üretmemek; Vercel açık yüzey + Linear yoğunluk disiplinini korumak.

| Rol | Nasıl | Ne kullanılmaz |
| --- | --- | --- |
| Birincil eylem (gönder, kaydet, başlat, ana CTA, FAB) | Koyu dolgu. Public/pazarlama ve site asistanında `variant="navy"`. Kayıt/kurulum formlarında `foreground` dolgu (`register-design.module.css` deseni veya eşdeğeri). | `variant="default"` / `bg-primary` parlak mavi dolgu; `gradient` variant; renkli gölge (`shadow-primary/*`) |
| İkincil eylem | `variant="outline"`, açık zemin, ince `border` | Primary tint hover (`hover:bg-primary/5`, `hover:border-primary/40`) — yerine `hover:bg-muted/60` |
| Üçüncül / geri / kapat (ikon) | `variant="ghost"`, `text-muted-foreground` | Renkli header üstünde beyaz ghost |
| Bağlantı, seçim, odak halkası | `text-primary` / ring token’ları | Birincil düğmeyi mavi yapmak |
| Durum (başarı / uyarı / hata) | Yalnız gerçek durumu anlatan token’lar | Dekoratif renkli header veya menü ikon zeminleri |

Ek kurallar:

- Panel / modal / widget başlıkları açık `card` + `border-b` olur; `bg-primary` renk bloğu kullanılmaz.
- Menü satırı ve özellik ikonları nötr `muted` + ince border alır; `bg-primary/10 text-primary-strong` dekoratif ikon kutusu yeni işte tercih edilmez.
- Sohbet balonları: ziyaretçi koyu (`navy` veya `foreground`), ajan / sistem `muted`; ziyaretçi balonunda parlak `primary` yok.
- Köşeler ölçülü (`rounded-lg` / `rounded-xl`, ~6–12px). Ağır `shadow-2xl` yerine sınırlı `shadow-md` / `shadow-lg`.
- Shared `Button` bileşeninin global `default` variant’ı bu belgeden dolayı değiştirilmez; call-site’ta `navy` / `outline` / `ghost` seçilir. `className` ile `bg-foreground` vermek `button.tsx` birleştirmesinde `bg-primary`’ı her zaman ezmez — public yüzeylerde `variant="navy"` kullan.

### Clutch buton ölçüleri — 13 Eylül 2026 (#647)

Kullanıcının Clutch ekran görüntüsü ve [Clutch](https://www.clutch.security/) canlı CSS'i buton geometrisinin referansıdır. Vercel'in sade yüzeyleri ve Linear'ın yoğunluk disiplini korunur. Bu açık talep, shared UI varsayılanlarını değiştirmeme kuralının **Button tipografisi ve ölçüleri için istisnasıdır**; `default` renk variant'ı değişmez.

- Metinli buton: Inter (`font-sans`), 14px, ağırlık 500, satır yüksekliği %140 (19.6px), harf aralığı −0.02em, köşe 6px. Metin ortalanır (`text-center`); koyu `navy` dolguda yazı tam beyazdır (`text-navy-foreground`), metne ek opacity verilmez. Outline/ghost kendi kontrastlı metin tokenlarını korur.
- `default` / `sm`: Clutch small — 38px yükseklik, iki yanda 14px padding, 6px ikon aralığı. İkon eklenince yatay padding daralmaz.
- `lg`: Clutch medium — 44px yükseklik, iki yanda 16px padding, aynı tipografi.
- `xl`: BakımX büyük CTA — 48px yükseklik, iki yanda 24px padding, aynı tipografi. Mobil ana CTA ve hero için kullanılır.
- `xs` / `compact`: yoğun tablo ve araç çubukları için 32px / 12px metin / 8px yatay padding. İkon boyutlarının mevcut 32px hit alanları korunur; ortak köşe 6px olur. FAB gibi özel şekiller kendi açık boyut ve radius tercihini korur.
- Header masaüstü CTA'sı `sm`, mobil CTA'sı `xl` kullanır. Boyut için `h-*` / `px-*` kopyalamak yerine `size` seçilir.
- Renk rolleri yukarıdaki tabloya uyar. Clutch'ın siyah gradient'i ve gölgesi aktarılmaz. Radix `asChild`, disabled, odak halkası ve hata durumları korunur.

## Uygulama, kayıt ve kurulum

- Açık `card` yüzey, `border` ile 1px ayraçlar ve `foreground` başlıklar temel düzeni oluşturur. Yardımcı metin `muted-foreground` kullanır. Dekoratif renkli kart yığınları ve büyük koyu arka plan panelleri yerine hizalama ve boşlukla hiyerarşi kurulur.
- Inter kullanılır. Form ve uygulama başlıkları yaklaşık 28–36px, alan etiketleri ve gövde 14–16px, yardımcı metin en az 12px olur. Pazarlama başlık ölçeği bu ekranlara uygulanmaz.
- Boşluklar 4/8px ritminde; alan araları 16–24px, mantıksal bölüm araları 24–40px. Form kontrolleri 40–44px yüksekliğinde, köşeler ölçülü (6–10px) olur. Tablo yoğunluğu göreve göre daha kompakt kalabilir.
- Birincil / ikincil / üçüncül eylem ayrımı yukarıdaki **Eylemler ve butonlar** tablosuna uyar. Hata, başarı ve uyarı renkleri yalnız gerçek durumu anlatır; kontrast kuralları korunur.
- Kayıtta yalnız sağdaki form alanı kayar; Header, sol açıklama sütunu ve alt footer görünüm alanında sabit kalır. Kayıt mevcut public `Header` bileşenini kullanır; açıklama sütununda logo tekrar edilmez. Kayıt masaüstünde sakin bir açıklama sütunu ve hesap formundan oluşur; mobilde form önceliklidir. Firma, iletişim ve giriş bilgileri ince ayraçlarla gruplanır. E-posta doğrulaması, KVKK, danışman/referans ve paket sözleşmeleri korunur.
- Sektör, iş detayları, ekip ve modül seçimleri üyelik sonrası dört adımlı kurulumda gösterilir. Kurulum uygulama kabuğu içinde çalışır; ikinci navigasyon kabuğu eklenmez. Seçenekler düzenli nötr yüzeylerde, seçili durum açık ve klavyeyle erişilebilir sunulur.
- Yerel CSS Module veya açık sayfa sınıfları kullanılır. Tasarım revizyonu tek başına global tokenları, shared UI varsayılanlarını, iş davranışını veya fiyat politikasını değiştirmez.
- Yeni UI işine başlamadan bu belge okunur. 320/390/768/1440px genişliklerde taşma ve okunabilirlik, klavye odağı, hata/başarı ve reduced-motion davranışı doğrulanır.

## Ana mesaj ve ürün sahnesi

Hero H1, servis sahiplerinin üç ana ağrısının kısa kolajıdır (İş emri 10 saniyede · Şaseden parça listesi · Her kayıt yerinde) — tek, sunucuda görünür. Altında bu üç vaadi bağlayan kısa açıklama. Ana CTA doğrudan `/register` adresine gider. Hero altındaki “Lite 0 TL/ay · Kredi kartı gerekmez” satırı kaldırılmıştır; analitik olay adları korunur.

Masaüstünde ortada etkileşimli dashboard, yanında iş emri / şase parça / canlı akış pencereleri. 640px ve altında Attio mobil desenine uyulur: yalnız etkileşimli dashboard çerçevesi kalır; uydu pencereler render edilmez (CSS de SSR/no-JS için gizler). Dashboard mock’u tıklanabilir tur içerir. Örnek veriler sayfada açıkça belirtilir.

## Demo modalı

“Birlikte inceleyelim” Radix Dialog açar; sayfayı aşağı kaydırmaz. Eski uzun demo bölümü kısa kapanış mesajıyla değiştirilmiştir. Modal: 640px'e kadar genişlik, 24/40px iç boşluk, açık zemin, gri arka perde, ekran yüksekliğini aşınca içeride kaydırma. Kapat düğmesi başlangıç odağıdır; Escape kapatır, odak tetikleyiciye döner.

Aynı react-hook-form + zod + shadcn Form bileşeni `/demo` üzerinde de kullanılır. Ad, telefon, servis adı, şehir, aylık araç adedi ve isteğe bağlı not; mevcut `/api/demo-request` sözleşmesine gönderilir. Sunucu hatasında girilen bilgiler korunur, başarıda teyit odağa alınır. Analitik başarı olayı yalnız başarılı API yanıtında çalışır. KVKK bağlantısı korunur. Yeni ticari koşul, API, DB veya bağımlılık yoktur.

## Motion test değerleri

Mevcut `framer-motion` paketi kullanılır. Kullanıcının açık Motion talebi önceki landing kısıtının bu yerel deneme için istisnasıdır. Kaynak: https://github.com/motiondivision/motion. Desen Qatchup tarzı **staggered fade+rise** (scroll-linked parallax değil).

| Alan | Başlangıç → bitiş | Tetikleyici |
| --- | --- | --- |
| Ürün pencereleri | opacity 0→1, y: 56→0, scale: 0.94→1, 1.15s | Sahne viewport’a girince bir kez; çocuklar 110ms stagger |
| Section öğeleri (kart, başlık, FAQ) | opacity 0→1, y: 40→0, 1s | Viewport altından ~12% içeride; bir kez; stagger 80–110ms |
| Üst çizgi | scaleX: 0 → 1, 3px | Sayfanın başından sonuna toplam kaydırma |
| Easing | [0.22, 1, 0.36, 1] | Tüm reveal’lar |

Hero H1 opacity ile gizlenmez (BAK-165 LCP). `prefers-reduced-motion: reduce` stagger’ı kapatır; JS kapalıyken `layout.tsx` noscript kuralı `[data-landing-motion]` öğelerini gösterir. Modalın 100ms açılış/kapanışı mevcut Radix/CSS geçişidir.

Test: masaüstünde hareket azaltma kapalıyken ana sayfayı yenileyip yavaş kaydırın. Ürün pencereleri sırayla belirmeli; `#neden` kartları kademeli fade+rise göstermeli. Üstteki 3px çizgi kaydırma ilerlemesini gösterir.

## Yerel teslim

Önizleme http://localhost:3000. Karşılaştırmalar `artifacts/issue-635/public-site/` altında. Önceki denemeler korunur. Bu çalışma kayıt dönüşümüne ilişkin ölçüm veya iddia içermez.

## 13 Eylül geliştirme uzlaştırması

Ana sayfadaki bağımsız “Canlı Demo / Ruhsat Okuma” bölümü kaldırılmıştır; tekrar eklenmez. Hero altındaki etkileşimli ProductStage ve “Birlikte inceleyelim” modalı korunur. Güncel yerel önizleme http://localhost:3000 adresindedir.

Footer sırası kolonlar → copyright → dekoratif BakımX watermark’tır; çözüm kolonlarında kategori başlıkları ve sayfa bağlantıları bulunur. Çerez tercihleri mobilde sağ alttaki asistan ve yukarı çık düğmelerinin üstünde yer alır. Eski reklam/click-ID entegrasyonu taslağı bu teslimata dahil değildir.
