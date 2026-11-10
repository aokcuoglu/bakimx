# UI kontrol boyutları

Input, Select ve InputGroup upstream shadcn `nova` ölçeğini korur (BAK-150).
#647 ile onaylanan Button istisnası Clutch ölçülerini kullanır; tasarım kararı
DESIGN.md'nin **Clutch buton ölçüleri** bölümündedir. Boyutlar breakpoint'e göre değişmez.

## Matris

| Kontrol | Ölçü | Not |
| --- | --- | --- |
| Button `default` / `sm` | 38px | 14px yatay padding, 14px metin |
| Button `lg` | 44px | 16px yatay padding |
| Button `xl` | 48px | 24px yatay padding |
| Button `xs` / `compact` | 32px | 8px yatay padding, 12px metin |
| Button tüm ikon varyantları | 32px | Mevcut hit alanı korunur |
| Input / InputGroup | 32px | upstream |
| Select `default` / `sm` / `compact` | 32px / 28px / 28px | upstream ve yoğun varyant |
| Textarea | `min-h-16` | upstream |

Button: Inter, ağırlık 500, satır yüksekliği %140, harf aralığı −0.02em,
6px köşe. Renk variant'ları ve Radix `asChild` sözleşmesi korunur.

**Mobil alt navigasyon** de korunur ama bu matrisin dışındadır: `MobileNavLink`
bir `Button` değil, `Link` (`src/components/layout/app-shell.tsx`) — yüksekliği
ikon + etiket + `py-1.5` ile doğal olarak oluşur.

## Köşe yarıçapı

`--radius: 0.625rem` (`src/app/globals.css`). Türev `--radius-sm … --radius-4xl`
bundan hesaplanır, elle ayarlanmaz.

## Kurallar

- Boyut sınıfları **çağrı yerinde ezilmez**. `h-11`, `h-12`, `size-11`,
  `size-12`, `min-h-[44px]` ve `md:h-9` gibi breakpoint ezmeleri kaldırıldı;
  yenisi eklenmez. İhtiyacın olan ölçek yoksa varyant ekle, `className` yazma.
- `compact` yalnız yoğun yönetim tabloları ve araç çubukları içindir.
- Dekoratif kareler (avatar, ikon rozeti, görsel küçük resmi, tam ekran
  fotoğraf görüntüleyicinin kendi kontrolleri) kontrol değildir; bu matrisin
  kapsamı dışındadır.
- Ham HTML etkileşimli kontrol kullanılmaz. Form gönderimi için kullanıcıya
  görünmeyen `input[type="hidden"]` alanları istisnadır. Uygulamanın ürettiği
  bağımsız ödeme/çıktı HTML belgeleri React bileşen ağacının dışında olduğundan
  bu kurala dahil değildir.

Matrisi `src/components/ui/control-sizing.test.ts` CI'da bekçiliyor.
