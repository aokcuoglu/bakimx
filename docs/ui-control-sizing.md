# UI kontrol boyutları

Kaynak: e-santral.com/bakimx kalıbı (`docs/design-pattern-esantral.md`),
kullanıcı kararı 22 Kasım 2026. **Telefonda iOS dokunma ölçüsü, `md` (768px) ve
üstü masaüstü veri ekranlarında kompakt ölçü.** Tek kırılım `md`'dir.

## Matris

| Kontrol | Telefon | Masaüstü (md+) | Not |
| --- | --- | --- | --- |
| Button `default` | 44px | 36px | hap (`rounded-full`), 17px / 15px metin |
| Button `sm` | 36px | 32px | 15px / 14px metin |
| Button `lg` | 50px | 44px | e-santral `.d-blue.big` |
| Button `xl` | 52px | 48px | |
| Button `xs` / `compact` | 32px | 28px | yoğun tablo ve araç çubuğu |
| Button `icon` / `icon-sm` / `icon-lg` | 44 / 36 / 50px | 36 / 32 / 44px | daire |
| Button `icon-xs` / `icon-compact` | 32px | 28px | |
| Input / InputGroup | 44px | 36px | 12px köşe (md+ 10px), 17px / 15px metin |
| Select `default` / `sm` / `compact` | 44 / 36 / 32px | 36 / 32 / 28px | |
| Textarea | `min-h-16` | `min-h-16` | 12px köşe |

Button: sistem fontu, ağırlık 500, harf aralığı −0.01em, düz dolgu (gölge yok).
Renk variant'ları ve Radix `asChild` sözleşmesi korunur.

**Mobil alt navigasyon** bu matrisin dışındadır: `MobileNavLink` bir `Button`
değil, `Link` (`src/components/layout/app-shell.tsx`).

**Pazarlama üst bandının hapı** (`PillButton size="nav"`, `.pillNav`) görselde
e-santral kaynağıyla birebirdir: telefonda ~37px (`8px 14px`). Dokunma alanı
şeffaf bir `::before` katmanıyla 44px'e çıkar (#810). Görünür boyutu 44px'e
büyütme; ihlal değil, bilinçli istisna.

**Alt sayfanın telefon geri bağlantısı** (`‹ Müşteriler`,
`page-trail.module.css` → `.back`) görselde 18px satırdır: breadcrumb satırının
yerini alır ve başlığın Y konumunu liste sayfasıyla aynı tutar. Dokunma alanı
aynı yolla, şeffaf `::before` ile 44px'tir (#855). Satırı 44px'e büyütme.

## Yazı ölçeği

`text-xs` / `text-sm` / `text-base` duyarlıdır (`globals.css` → `--fs-*`):
telefonda 13 / 16 / 17px, masaüstünde 12 / 15 / 16px. Gövde `text-base`.

## Köşe yarıçapı

`--radius: 1rem` (16px, kart ve yüzey). Diyalog `--radius-dialog: 1.75rem`.
Düğmeler hap. `--radius-sm/md/xl` sabit değerlerdir.

## Kurallar

- Boyut sınıfları **çağrı yerinde ezilmez**. İhtiyacın olan ölçek yoksa varyant
  ekle, `className` yazma. `md` dışındaki kırılımla boyut değiştirme.
- `compact` yalnız yoğun yönetim tabloları ve araç çubukları içindir.
- Dekoratif kareler (avatar, ikon rozeti, görsel küçük resmi, tam ekran
  fotoğraf görüntüleyicinin kendi kontrolleri) kontrol değildir; bu matrisin
  kapsamı dışındadır.
- Ham HTML etkileşimli kontrol kullanılmaz. Form gönderimi için kullanıcıya
  görünmeyen `input[type="hidden"]` alanları istisnadır.

Matrisi `src/components/ui/control-sizing.test.ts` ve
`src/app/design/design-system.test.ts` CI'da bekçiliyor.
