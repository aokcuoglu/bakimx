# Genel arama — canlı Attio ölçümü (#712)

30 Eylül 2026: Zen’de `https://app.attio.com/bakimx/home` → sidebar Search →
DevTools Console. Orca F12’yi desteklemediğinden aynı panel ⌘⌥I ile açıldı.
`getBoundingClientRect()` ve `getComputedStyle()` kullanıldı; değerler CSS pikselidir.

| Yüzey | Canlı değer |
| --- | --- |
| İç panel | 740px genişlik, 12px köşe; 1px dış çerçeve ve 3px dış halka |
| Yerleşim | Ekran yüksekliğinin %14’ü üst boşluk; gövde üst sınırı %70 |
| Arama başlığı | 52px + 1px ayraç; 4px 16px padding |
| Arama metni | Inter 16px / 500 / yaklaşık 20px |
| Liste | Yatay 10px padding |
| Seçenek | 36px; 12px köşe; içeride 6px 12px 6px 6px padding |
| İkon | 24px kutuda 16px ikon; metinle 6px boşluk |
| Seçili satır | rgb(246, 247, 247) |
| Alt eylem | 28px yüksek, 8px köşe; 4px 6px 4px 8px padding |
| Dış gölge | Ortak `--shadow-dialog` ile aynı üç katman |

BakımX’in önceki 928px paneli 742px dış çerçeveye indirildi; 540px iç yükseklik
büyük ekranda sınırlandırılır. Mobilde 12px kenar boşluğu ve %85 yükseklik sınırı
kullanılır. Liste içeride kayar, 44px alt şerit görünür kalır. Arama başlığının
tekrarlanan büyüteç ikonu kaldırıldı; erişilebilir kapatma düğmesi korundu.

Yerel CSS Module renkleri mevcut tema değişkenlerinden türetir. Alt düğme seçili
komutu çalıştırır; kayıt araması, sayfa geçişi, rol ve plan filtreleri aynı kalır.
Attio’nun Ask Attio eylemi ve mevcut olmayan kısayolları eklenmez.

Doğrulama: `global-search-palette.e2e.ts` 320/390/768/1440px sınırları, satır
ölçüsü, iç kaydırma sırasında alt eylem, klavye seçimi ve kayıt kapsamı odağını
kontrol eder. Mevcut `workspace-settings-sidebar.e2e.ts` kayıt araması,
Enter/Escape ve mobil sidebar akışlarını ayrıca kapsar.
