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
| Input / InputGroup | 44px | 36px | 10px köşe (md+ 8px, `--control-radius`), 17px / 15px metin |
| Select `default` / `sm` / `compact` | 44 / 36 / 32px | 36 / 32 / 28px | |
| `ToggleGroup` / `Toggle` `size="control"` | 44px | 36px | öğe yüksekliği; ray kendi dolgusunu ekler |
| `Tabs` — `TabsList size="control"` (segment) | 44px | 36px | trigger yüksekliği; şerit `h-auto` |
| Textarea | `min-h-16` | `min-h-16` | 10px köşe (md+ 8px, `--control-radius`) |

`default/sm/lg` Toggle (32px) ve `line` sekme (28px) upstream nova ölçeğidir;
yalnız masaüstü yoğun araç çubuğu ve tablo başlığı içindir. Telefonda görünen
seçici `size="control"` alır; sekmede `size="control"` yalnız `default` (segment)
variant içindir, telefonda görünen `line` sekmenin ölçeğe bağlanması #854'te. İlke: etkileşimli öğe `--control-h`,
şerit/ray `auto` — `order-detail.module.css` `.tab` aynı ilkenin mevcut örneğidir.

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

Uygulama içi köşeler e-santral kalıbının bir kademe altıdır (karar 25-11, #878).
Dört token, hepsi `globals.css`:

| Token | Değer | Nerede |
| --- | --- | --- |
| `--radius` | 12px (`0.75rem`) | Card, Popover; `rounded-lg` buna bağlıdır |
| `--radius-panel` | 14px (`0.875rem`) | Panel, KPI kartı (`var(--radius-panel)` / `rounded-(--radius-panel)`) |
| `--radius-dialog` | 18px (`1.125rem`) | Dialog, AlertDialog, mobil BottomSheet üst köşesi |
| `--control-radius` | 10px telefon / 8px md+ | Input, Select tetikleyicisi, Textarea, InputGroup, Alert |

Köşe md'de değişen tek token `--control-radius`'tur; `--control-*` ailesi gibi
`@media (min-width: 768px)` bloğunda kırılır, bileşende `md:rounded-` yazılmaz.
Düğmeler hap (`rounded-full` / telefon yüksekliğinin yarısı), durum hapları ve
avatarlar daire kalır. `--radius-sm/md/xl` sabit değerlerdir (6 / 8 / 12px).

**Bilinçli istisna — InputGroup içindeki düğme.** `InputGroupButton`'ın `xs`
(varsayılan) ve `icon-xs` boyutları hap değildir: grubun köşesini eş merkezli
izler, `calc(var(--control-radius) - 3px)` = telefonda 7px, md+ 5px (kbd
rozeti `- 5px` = 5 / 3px). Kutunun içinde duran düğme kutudan yuvarlak olursa
köşesi çerçeveye çarpar; iç köşe her zaman dış köşeden küçüktür (#878).
`sm` / `icon-sm` boyutları `Button`'ın kendi köşesini taşır.
Pazarlama yüzeyi bu token'lara bağlı değildir; `--mk-r-*` ölçeğini kullanır.

### İç içe köşe

Bir kutunun içindeki kutu dıştakinden daha az yuvarlak olmalı; aynı köşe iki
kutuyu "aynı yarıçap" gibi gösterir ve çerçeve köşeye çarpar (#898).

- Card (12) / panel (14) / Popover (12) / Dialog (18) içindeki kutu — bilgi
  kutusu, satır, bildirim, segment sarmalayıcı — `rounded-md` (8px).
- O kutunun içindeki kutu `rounded-sm` (6px).
- `rounded-lg`, `rounded-xl` ve `rounded-(--radius-panel)` yalnız **kaptır**:
  sayfa zemini üzerindeki bağımsız kutu, Popover/Select/Dropdown içeriği, diyalog
  kabuğu, yüzen öğe.
- Küçük resim ve ikon karoları aynı adımı izler (kartın içinde `rounded-md`).
  Avatar ve durum hapları `rounded-full` kalır.

Kapı: `src/lib/nested-radius.test.ts` (`harness:gates`). Sınırı: yalnız AYNI
dosyadaki sözcüksel iç içeliği görür; başka dosyada Card içine render edilen
bileşenin kök köşesini yakalamaz. Kapsam dilim dilim genişler; bilinçli
istisnalar dosyadaki `ALLOWLIST`te gerekçesiyle durur.

## Kurallar

- Boyut sınıfları **çağrı yerinde ezilmez**. İhtiyacın olan ölçek yoksa varyant
  ekle, `className` yazma. `md` dışındaki kırılımla boyut değiştirme.
- `ToggleGroupItem` / `TabsTrigger` / `TabsList` üzerinde `!` ile yükseklik
  ezilmez (`h-7!`). Telefonda tek başına duran eylem düğmesi `default` ya da
  üstüdür; `sm/xs/compact` yoğun satır ve araç çubuğu içindir.
- `compact` yalnız yoğun yönetim tabloları ve araç çubukları içindir.
- Dekoratif kareler (avatar, ikon rozeti, görsel küçük resmi, tam ekran
  fotoğraf görüntüleyicinin kendi kontrolleri) kontrol değildir; bu matrisin
  kapsamı dışındadır.
- Ham HTML etkileşimli kontrol kullanılmaz. Form gönderimi için kullanıcıya
  görünmeyen `input[type="hidden"]` alanları istisnadır.

Matrisi `src/components/ui/control-sizing.test.ts` ve
`src/app/design/design-system.test.ts` CI'da bekçiliyor.
