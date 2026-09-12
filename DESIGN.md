# BakımX — Attio referanslı yerel deneme (#635)

12 Eylül 2026 kullanıcı geri bildirimi önceki iki sütunlu tasarımı değiştirir. Kaynak: kullanıcının paylaştığı üç ekran görüntüsü ve https://attio.com/. Kapsam giriş ve hemen altındaki ürün anlatımıdır; PR, merge ve yayın yoktur.

## Ana mesaj

“Servisiniz büyüsün. Kontrol sizde kalsın.” Merkezde tek H1, iki satır. Altında araç kabul, parça, iş emri ve tahsilatı bağlayan kısa açıklama. İki mevcut hedef korunur: `/fiyatlar#lite` ve `#demo-form`; analitik event adları ve konum parametreleri değişmez. Yeni bir fiyat politikası yoktur: Lite 0 TL/ay mevcut teklifidir.

## Görsel dil

Beyaz `card` zemini, ince `border` dikey çizgileri, koyu `foreground` başlık, ikincil `muted-foreground` metin. Geist kullanılır. H1 masaüstünde 84px'e kadar, mobilde 36–56px; sıkı harf aralığı, 1.03 satır yüksekliği. Girişte 100px üst boşluk, içerikte 1280px sınır. İki CTA 48px yüksekliğinde; mobilde tam genişlikte ve ana CTA önce görünür. Stiller CSS Module ile yalnız bu iki bölüme bağlıdır.

## Katmanlı ürün alanı

Ortada 1000px civarında bir servis özeti penceresi; ön solda iş emri, ön sağda şaseyle ilişkili katalog sonuçları. Yumuşak mavi zemin, ince pencere başlıkları, hafif gölgeler ve derinlik. Dashboard ve iş emri, ürünün işlevlerini anlatan HTML/CSS demo kompozisyonlarıdır; birebir ekran görüntüsü değildir. Sabit servis, müşteri, plaka ve tutarlar örnektir. Parça alanı mevcut `parts-catalog.png` görselinin listeye odaklanan kırpımıdır. Sayfada örnek veri açıklaması bulunur.

Mobilde pencereler sıralı yerleşir; dashboard'ın dekoratif menüsü ve ikincil grafik kartları kaldırılır. Görsel katmanlar mobilde üst üste binmez. Sunulan veriler gerçek servis performansı ya da dönüşüm kanıtı değildir.

## Motion

Kullanıcı bu revizyonda Motion kullanımına açıkça izin verdi. Mevcut `framer-motion` paketi kullanılır; yeni bağımlılık yoktur. Resmî kaynaklar: https://github.com/motiondivision/motion ve https://motion.dev/docs/react-use-scroll.

Yalnız ürün pencereleri `useScroll` + `useTransform` ile hareket eder. Merkez pencere küçük bir ölçek ve dikey hareket alır; iki yan pencere farklı mesafelerle yerleşir. `initial={false}` kullanılır, opacity ile gizleme yoktur. H1 normal HTML'dir ve Motion import etmez. Projede bulunan ve sunucu hidrasyonunu koruyan `usePrefersReducedMotion` ile hareket azaltma desteklenir; CSS media query mobilde ve reduced-motion durumunda transform'u kaldırır. Görsel boyutları baştan ayrılır.

## Teslim

Önizleme: http://localhost:3100. Görseller: `artifacts/issue-635/attio/`. İlk denemenin görselleri üst klasörde karşılaştırma için saklıdır. Kayıt dönüşümü ölçülmez. Sonraki adım ürün sahibinin yerel tasarımı değerlendirmesidir.
