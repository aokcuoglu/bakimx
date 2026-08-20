# UI kontrol boyutları

Kontrol ölçeği **upstream shadcn `nova` ile aynıdır**: tek ölçek, breakpoint yok
(BAK-150). Kaynak `ui.shadcn.com`'un kendi registry JSON'u; `base-nova` ile
`radix-nova` bu değerlerde birebir aynı, yani ölçek primitive geçişinden
bağımsızdır.

Öncesinde matris mobilde `h-11` (44px), `md+` ekranda `h-9` (36px) idi. 32px'e
inildi çünkü WCAG 2.2 **AA** 2.5.8 eşiği 24px'tir ve 32px onu rahatça geçer;
düşen yalnızca **AAA** 2.5.5'in 44px hedefidir (alpkaan onayı, BAK-149).

## Matris

| Kontrol | Ölçü | Not |
| --- | --- | --- |
| Button `default` | `h-8` | upstream |
| Button `xs` | `h-6` | upstream |
| Button `sm` | `h-7` | upstream |
| Button `compact` | `h-7` | BakımX — yoğun tablo/araç çubuğu, `text-xs` |
| Button `icon` | `size-8` | upstream |
| Button `icon-xs` / `icon-sm` / `icon-lg` | `size-6` / `size-7` / `size-9` | upstream |
| Button `icon-compact` | `size-7` | BakımX |
| Input | `h-8` | upstream |
| InputGroup | `h-8` | upstream |
| Select `default` / `sm` | `h-8` / `h-7` | upstream |
| Select `compact` | `h-7` | BakımX, `text-xs` |
| Textarea | `min-h-16` | upstream |

## İki istisna — ve neden breakpoint taşıyorlar

| Kontrol | Mobil | `md+` |
| --- | --- | --- |
| Button `lg` — birincil CTA | `h-10` | `h-9` (upstream `lg`) |
| Button `xl` — tam genişlik CTA (auth, public paylaşım, filtre sheet) | `h-11` | `h-10` |

Gerekçe: atölye ortamında telefon çoğu zaman tek elle, eldivenle veya yağlı
parmakla kullanılıyor. Formu gönderen tek düğmenin ıskalanması diğer
kontrollerden pahalı. Ekranın geri kalanı upstream yoğunluğunda kalır.

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
