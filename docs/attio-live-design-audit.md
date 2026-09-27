# Attio canlı arayüz incelemesi — 27 Eylül 2026 / #682

Kaynak: kullanıcının oturumundaki `app.attio.com`, şirket kaydı Overview ve Activity, New meeting dialogu, Companies listesi. Zen DevTools Console üzerinden `getComputedStyle` kullanıldı. Ağ istekleri, oturum bilgileri veya müşteri içerikleri dışarı aktarılmadı. Bu belge ölçülen tasarım rollerini içerir; tüm Attio ürününün eksiksiz CSS dökümü değildir.

## Ölçülen değerler

| Rol | Canlı CSS |
| --- | --- |
| Font | Inter (değişken font) |
| Sekme metni | 14px / 20px, 500, −0.07px tracking |
| Sekme düğmesi | 28px yükseklik, 4px 8px padding, 6px ikon aralığı, 8px köşe |
| Seçili sekme | #fbfbfb yüzey, #eeeff1 iç 1px çizgi; ayrı alt çizgi |
| Sekme satırı | düğme + altındaki 8px boşluk, arada 4px gap |
| Kayıt başlığı | 16px / 20px, 600 |
| Kart etiketi / özellik bölümü etiketi | 12px / 16px, 500 |
| Kart değeri | 14px / 20px, 500 |
| Özet kart içerik | ölçülen örnekte 86px yükseklik; yatay 12px iç boşluk |
| Overview içerik | 24px 20px padding; bölümler arası 32px |
| Modal başlığı | 14px / 20px, 500 |
| Modal içerik başlığı | 18px / 24px, 600, −0.36px tracking |
| Modal dış yüzeyi | 808px ölçülen genişlik; 16px köşe, 3px dış çerçeve boşluğu |
| Modal gölgesi | 0 8px 28px −6px rgba(28,40,64,.12), 0 18px 88px −4px rgba(28,40,64,.16), 0 0 1px rgba(28,40,64,.16) |
| Modal footer | 8–12px yatay padding, 8px gap, beyaz yüzey |

Attio body font-size değeri **10px**; görünür metinler kendi 12/14/16/18px boyutlarını tanımlıyor. BakımX body'yi 10px yapmak yanlış sonuç verirdi. Bunun yerine görünür gövde ölçeği 14/20 uygulanır. Ölçüler CSS pikselidir; kullanıcının tarayıcı zoom'u ekran görüntüsündeki fiziksel boyutları değiştirir.

## BakımX uygulaması

- Mevcut `next/font` Inter yükleyicisi korunur. Gövde 14/20, bölüm etiketi 12/16, kayıt başlığı 16/20; uygulama sayfa başlığı 20/28 (yerel içerik ihtiyacı), ağırlık 600. Public display / blog editoryal başlıkları uygulama boyutuna indirilmez.
- `TabsList variant="line"`: seçili sekmede nötr çerçeve ve zemin **ile birlikte** 1px alt çizgi. `default` segmented kontroller için kalır. Yatay/dikey yön ve Radix klavye davranışı korunur.
- `Card`: 12px köşe ve token üzerinden ince sınır. `HighlightCard`: 12px etiket, 14px değer, opsiyonel ikon/açıklama. StatCard, dashboard KPI ve rapor kartları bunu kullanır. Filtre linkleri korunur; aynı sayının iki kez gösterildiği dekoratif badge kaldırılır, açıkça verilen badge kalır.
- `Dialog` ve `AlertDialog`: 16px köşe (kullanıcının modal referansı için açık istisna), ince çerçeve, ölçülen katmanlı gölge. Arka plan yoğun karartma/blur yapmaz. Başlık 14px, footer beyaz, ayraçlar ince. Küçük/az yüksek ekranlarda içerik kayar. Modal genişlikleri içeriğe göre korunur.
- Formlar RHF + zod + shadcn kullanır. Odak hapsetme/geri verme, Escape ve Base UI popup koruması değişmez. Hareket azaltma tercihinde açılış/kapanış animasyonu yoktur.
- Nötr yüzeyler ve yardımcı metin `globals.css` tokenlarından gelir; anlamlı durum renkleri ve BakımX koyu CTA kararı korunur.
- Canlı bileşen örneği `/design#cards`; örnek form gerçek kayıt oluşturmaz.

## Doğrulama

`e2e/attio-design.e2e.ts`: 320/390/768/1440px; sekme klavyesi ve hesaplanan stil, modal açma/kapatma, form doğrulaması, popup Escape, odak dönüşü, yatay taşma, kısa ekran/koyu tema ve reduced motion.
