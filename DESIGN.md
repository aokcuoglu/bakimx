# BakımX — Attio referanslı public site (#635)

## Kapsam

12 Eylül 2026 tarihli kullanıcı geri bildirimleri önceki iki bölümlük denemenin yerini alır. Referans kullanıcının Attio ekran görüntüleri ve https://attio.com/. Ana sayfanın tamamı, üç ürün tanıtım sayfası, karşılaştırma, iki rehber, fiyatlar, demo, sistem durumu ve dört hukuki belge ortak `PublicSite` görünümünü kullanır. Uygulama, yönetim, kimlik doğrulama ve müşteriye özel işlem ekranları bu pazarlama tasarımının dışında kalır. PR, merge veya yayın yoktur.

## Görsel dil

Geist; beyaz `card` zemin; ince `border` ayraçlar; koyu `foreground` başlıklar; `muted-foreground` açıklamalar. Mavi, ürün verilerinde ve bağlantılarda vurgu olarak kalır. Büyük renk blokları açık yüzeylere dönüştürülür. Ortak içerik sınırı 1200px, ürün sahnesi 1440px. Bölüm boşlukları masaüstünde 64–120px, mobilde 64px. Ana H1 84px'e, tanıtım sayfaları 76px'e kadar ölçeklenir. Başlıklarda sıkı harf aralığı ve dengeli satır kırılması kullanılır. Rehber ve hukuki metinlerin içerikleri korunur.

`PublicSite` ve CSS Module yalnız açıkça sarılmış site sayfalarına uygulanır. Uygulamanın global tokenları veya paylaşılan UI bileşenlerinin varsayılanları değiştirilmez. Header/Footer ortak açık görünüm kullanır. Mobil ürün görselleri dikey sıralanır; CTA'lar dar alanda alt alta gelir.

## Ana mesaj ve ürün sahnesi

“Servisiniz büyüsün. Kontrol sizde kalsın.” Tek, sunucuda görünür H1. Altında araç kabulü, parçalar, iş emirleri ve tahsilatı bağlayan kısa açıklama. Ana CTA `/fiyatlar#lite`, mevcut Lite teklifi ve analitik adları korunur.

Ortada dashboard, solda iş emri, sağda şase bazlı parça listesi. Dashboard ve iş emri açıklayıcı HTML/CSS örnekleridir; canlı ürün ekranının birebir kopyası değildir. Parça listesi mevcut `parts-catalog.png` kırpımıdır. Örnek veriler sayfada açıkça belirtilir.

## Demo modalı

“Birlikte inceleyelim” Radix Dialog açar; sayfayı aşağı kaydırmaz. Eski uzun demo bölümü kısa kapanış mesajıyla değiştirilmiştir. Modal: 640px'e kadar genişlik, 24/40px iç boşluk, açık zemin, gri arka perde, ekran yüksekliğini aşınca içeride kaydırma. Kapat düğmesi başlangıç odağıdır; Escape kapatır, odak tetikleyiciye döner.

Aynı react-hook-form + zod + shadcn Form bileşeni `/demo` üzerinde de kullanılır. Ad, telefon, servis adı, şehir, aylık araç adedi ve isteğe bağlı not; mevcut `/api/demo-request` sözleşmesine gönderilir. Sunucu hatasında girilen bilgiler korunur, başarıda teyit odağa alınır. Analitik başarı olayı yalnız başarılı API yanıtında çalışır. KVKK bağlantısı korunur. Yeni ticari koşul, API, DB veya bağımlılık yoktur.

## Motion test değerleri

Mevcut `framer-motion` paketi kullanılır. Kullanıcının açık Motion talebi önceki landing kısıtının bu yerel deneme için istisnasıdır. Kaynaklar: https://github.com/motiondivision/motion ve https://motion.dev/docs/react-use-scroll.

| Alan | Başlangıç → bitiş | Tetikleyici |
| --- | --- | --- |
| Dashboard | y: 140 → 0px, scale: 0.92 → 1 | Ürün sahnesinin üstü viewport altına değdiğinde başlar; merkezler hizalandığında biter |
| İş emri | y: 240 → −12px | Aynı kaydırma aralığı |
| Parça penceresi | y: 280 → 12px | Aynı kaydırma aralığı |
| Diğer doğrudan main bölümleri | y: 36 → 0px, 750ms | Viewport altından 60px içeride ilk görünüş; bir kez; easing [0.22, 1, 0.36, 1] |
| Üst çizgi | scaleX: 0 → 1 | Sayfanın başından sonuna toplam kaydırma |

Ürün pencereleri `initial={false}` kullanır. H1 ve metinler opacity ile gizlenmez; JavaScript kapalıyken ilk içerik görünürdür. 640px ve altında katman hareketi kapanır. `prefers-reduced-motion: reduce` bütün bu Motion efektlerini kapatır. Modalın 100ms açılış/kapanışı mevcut Radix/CSS geçişidir, Motion olarak sunulmaz.

Test: masaüstünde hareket azaltma kapalıyken ana sayfayı en üste alın, ilk 700–1000px'i yavaş kaydırın. Yan pencereler dashboard'dan daha uzun yol alır. Sonraki bölümlere ilk inişte yukarı hareketi izleyin; tekrar görmek için sayfayı yenileyin. Üstteki 2px çizgi kaydırma ilerlemesini gösterir.

## Yerel teslim

Önizleme http://localhost:3100. Karşılaştırmalar `artifacts/issue-635/public-site/` altında. Önceki denemeler korunur. Bu çalışma kayıt dönüşümüne ilişkin ölçüm veya iddia içermez.
