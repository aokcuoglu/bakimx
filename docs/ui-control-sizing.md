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
| Button `toolbar` | 36px | 32px | `sm` boyu, ikon-metin arası 8px — araç çubuğu |
| Button `inline` | metin boyu | metin boyu | satır içi bağlantı / eylem (#889): dolgu ve yükseklik yok, yazı boyutu ve satır yüksekliği çevreden (`text-[length:inherit]`); boyutu ata öğe ya da çocuk `<span>` verir |
| Button `row` | en az 44px | en az 36px | çok satırlı liste satırı, seçenek kartı, bırakma alanı (#889): sola hizalı, metin kırılır, `px-3 py-2.5`, 8px köşe (`rounded-md`), 15 / 14px metin; genişliği çağrı yeri verir (`w-full`, `flex-1 min-w-0`) |
| Button `tile` | içerik | içerik | görsel küçük resmi / fotoğraf ekle karosu (#889): dolgusuz, `flex-col`, taşanı kırpar, 8px köşe; oranı çağrı yeri verir (`aspect-square w-full`) |
| Input / InputGroup `default` | 44px | 36px | 10px köşe (md+ 8px, `--control-radius`), 17px / 15px metin — her form, diyalog ve arama alanı |
| Input / InputGroup `sm` | 36px | 32px | köşe ve metin `default` ile aynı — yoğun filtre araç çubuğu, tablo başlığı süzgeci |
| Input / InputGroup `compact` | 32px | 28px | 16px / 14px metin (`--control-fs-field-xs`) — tablo satırı içi düzenleyici |
| Input / InputGroup `lg` | 50px | 44px | köşe ve metin `default` ile aynı — tek başına duran büyük giriş (plaka, teslim kodu) |
| Select `default` / `sm` / `compact` | 44 / 36 / 32px | 36 / 32 / 28px | |
| `ToggleGroup` / `Toggle` `size="control"` | 44px | 36px | öğe yüksekliği; ray kendi dolgusunu ekler |
| `ToggleGroupItem` `size="row"` | en az 44px | en az 36px | seçenek kartı (ikon + başlık + açıklama, #889): Button `row` ile aynı ölçü |
| `Tabs` — `TabsList size="control"` (segment) | 44px | 36px | trigger yüksekliği; şerit `h-auto` |
| Textarea | `min-h-16` | `min-h-16` | 10px köşe (md+ 8px, `--control-radius`) |

**Input / InputGroup `size`** `--control-h`, `--control-fs` ve `--field-px`
değişkenlerini öğenin kendisinde yeniden bağlar; taban sınıflar aynı kalır.
`InputGroup` bağlamayı grup üzerinde yaptığı için içindeki `InputGroupInput`
yüksekliği, metni ve dolguyu gruptan miras alır (kendi `size` prop'u yoktur);
`sm` / `compact` grupta `InputGroupButton` kutudan taşmayacak kadar küçülür.
`ComboboxInput` aynı `size`'ı `InputGroup`'a geçirir. `PartSearchInput`,
`PartAttributeField` ve `FilterSelect` da `size` alır (kalem satırında
`compact`, yoğun filtre çubuğunda `sm`).

**Autocomplete eklentili grupta:** `AutocompleteInput` bir `InputGroup` içinde
eklentiyle (🔍 / X, SKU çipi) duruyorsa kap `AutocompleteInputGroup`'tur
(Base UI `Autocomplete.InputGroup` + `InputGroup`). Popup girdiye değil kutuya
çapalanır, liste kutunun tam genişliğinde ve hizasında açılır; düz
`InputGroup`'ta eklenti genişliği kadar dar kalıyordu.
`src/components/ui/input-group-contract.test.ts` bekçiliyor.

**Odak halkası** tüm form kontrollerinde aynıdır: `ring-4 ring-ring/20`,
geçersizde `ring-4 ring-destructive/10` (koyu temada `/20`). `InputGroup`
halkayı grupta çizer ve iç denetimin `data-slot`'una bağlı değildir
(`has-[input:focus-visible]`); `InputGroupInput` slot'unu props'tan sonra
yazar.

**iOS yakınlaştırması:** iOS Safari 16px altındaki metin girdisine odaklanınca
sayfayı yakınlaştırır. Bu yüzden `compact` girdinin metni telefonda 16px'te
kalır, yalnız md+ 14px'e iner (`--control-fs-field-xs`). `--control-fs-xs`
(telefonda 14px) metin girdisinde kullanılmaz; yalnız Select ve düğme içindir.

`default/sm/lg` Toggle (32px) ve `line` sekme (28px) upstream nova ölçeğidir;
yalnız masaüstü yoğun araç çubuğu ve tablo başlığı içindir. Telefonda görünen
seçici `size="control"` alır; sekmede `size="control"` yalnız `default` (segment)
variant içindir, telefonda görünen `line` sekmenin ölçeğe bağlanması #854'te. İlke: etkileşimli öğe `--control-h`,
şerit/ray `auto` — `order-detail.module.css` `.chip` (araç kabulü bölüm çipi, #911) aynı ilkenin mevcut örneğidir.

Button: sistem fontu, ağırlık 500, harf aralığı −0.01em, düz dolgu (gölge yok).
Renk variant'ları ve Radix `asChild` sözleşmesi korunur.

**Button `variant="field"`** (#889): değer seçen Popover tetikleyicisi (birim,
tarih) girdi gibi görünür — `border-input`, `bg-card`, ağırlık 400, girdinin
köşesi (`--control-radius`, `compoundVariants` ile her boyutta) ve form
kontrollerinin odak / geçersiz halkası (`ring-4 ring-ring/20`,
`ring-4 ring-destructive/10`). Boyu yanındaki girdiyle aynı `size`'dır: kalem
satırında `compact` (metni compact girdiyle aynı `--control-fs-field-xs`,
telefonda 16px), formda `default` (`OrderItemUnitCombobox`).

**Button `row`** satırları variant'tan bağımsız aynı çerçeve kutusundadır
(kenarlıksız variant'lar şeffaf 1px çerçeve alır): seçili `secondary` satır
`outline` komşularından kısa kalmaz, seçim değişince satır kaymaz. Hayalet
(`ghost`) satırın metni `foreground`'dur — soluk satır devre dışı gibi okunur.
Satır listesi kenardan kenara uzanıyorsa kabı `p-1` / `px-1` alır, yuvarlak
hover kabuk kenarına değmez.

**Seçili durum** `className` ile boyanmaz, `variant` değişir:
`variant={selected ? "secondary" : "outline"}` (seçim listesinde
`aria-pressed`). Tek/çok seçim `ToggleGroup` + `ToggleGroupItem`'dır:
- `variant="outline"` — seçili öğe birincil ton (`border-primary`,
  `bg-primary/10`, `text-primary-strong`; e-santral: mavi = eylem ve seçim).
  Etiket, fiyat grubu, modüller, ödeme yöntemi, çalışma günleri.
- `variant="segment"` — iOS segment denetimi: gri ray (`bg-muted`, 2px dolgu)
  içinde seçili öğe beyaz kart; öğe köşesi raydan bir kademe küçük. Birbirini
  dışlayan iki-üç görünüm/tip (`Bireysel / Kurumsal`, `Aylık / Yıllık`).
  `Tabs` `default` şeridiyle aynı dil, ama form değeri olduğu için `tablist`
  değil `radiogroup`.
- Öğe boyu `size="control"` (telefonda görünen seçici), seçenek kartı
  `size="row"`; yoğun filtre çip satırı `sm` (32px). Grup erişilebilir ad taşır
  (`aria-label`).

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

Kapı: `src/lib/nested-radius.test.ts` (`harness:gates`). Card, panel, Popover
ve benzeri kapların (diyalog kabuğu dahil) içindeki `rounded-lg/xl` iç kutuyu
yakalar; `sm:` gibi önek ve `rounded-s-lg` gibi mantıksal kenarlar da sayılır,
`className` içindeki şablon metni, üçlü ifade ve `cn({...})` anahtarları taranır.
Sınırı: yalnız AYNI dosyadaki sözcüksel iç içeliği görür; başka dosyada Card
içine render edilen bileşenin kök köşesini ve değişkenden/prop'tan gelen
`className`i yakalamaz. Kapsam dilim dilim genişler; bilinçli
istisnalar dosyadaki `ALLOWLIST`te gerekçesiyle durur.

## Kurallar

- Boyut sınıfları **çağrı yerinde ezilmez**. İhtiyacın olan ölçek yoksa varyant
  ekle, `className` yazma. `md` dışındaki kırılımla boyut değiştirme.
- Form kontrolleri (`Input`, `InputGroup`, `InputGroupInput`,
  `InputGroupTextarea`, `Textarea`, `SelectTrigger`, `AutocompleteInput`,
  `ComboboxInput`, `ComboboxChips`, `AutocompleteInputGroup`) ve onlara
  `className` ileten sarmalayıcılar (`FilterSelect`, `CitySelect`,
  `DistrictSelect`) açılış etiketinde yükseklik (`h-*`, `min-h-*`, `size-*`),
  köşe (`rounded*`), yazı boyutu (`text-xs…xl`, keyfi uzunluk), satır
  yüksekliği (`leading-*`), dolgu (`p-*`, `py-*`, `pt-*`, `pb-*`), kenarlık
  kaldırma/kalınlığı (`border-0|none|transparent`, `border-2|4|8`), zemin
  (`bg-*`), gölge (`shadow-*`), halka (`ring-*`), `outline-*` ve yazı
  ağırlığı (`font-medium…`) taşımaz; `!` ve `md:` / `data-[…]:` önekleri de
  sayılır. CSS modülü sınıfı (`className={styles.x}`) da ihlaldir. Yeni bir
  sarmalayıcı `className`'i kontrole iletiyorsa kapının listesine eklenir
  (test bunu ister). `className` yerleşim içindir: genişlik, flex/grid, dış boşluk, ikon
  yeri için yatay dolgu (`pl-9`), `text-right`, `tabular-nums`, `font-mono`,
  `uppercase`, `tracking-*`. Textarea içerik yüksekliği yalnız ölçekten
  (`min-h-20`, `min-h-[80px]` değil). Bilinçli istisna gerekçesiyle
  `src/components/ui/control-call-sites.test.ts` listesine yazılır; artık
  eşleşmeyen istisna testi düşürür.
- Düğmeler ve seçiciler (#889): `Button`, `InputGroupButton`, onlara
  `className` / `*ClassName` ileten sarmalayıcılar (`PrintButton`,
  `PhotoDeleteButton`, `OrderItemUnitCombobox`, `TechnicianAssign`,
  `SidebarTrigger`, `FilterSheet` `triggerClassName`…) ve `ToggleGroup` /
  `ToggleGroupItem` / `Toggle` açılış etiketinde yükseklik (`h-*` — `h-full` hariç,
  `min-h-*`, `max-h-*`, `size-*` — `size-full` hariç), köşe (`rounded*`), yazı
  boyutu, satır yüksekliği, dikey dolgu (`p-*`, `py-*`, `pt-*`, `pb-*`), yazı
  ağırlığı ve `focus*:` önekli `ring-*` / `outline-*` taşımaz. Öneksiz ya da
  yalnız ekran / kap genişliği veya tema önekli (`md:`, `max-md:`,
  `min-[…]:`, `@xl:`, `dark:`) `bg-background|card|transparent|muted` (yarı
  saydam `/95` dahil), `border-0|none|transparent` ve `shadow-none` de
  yasaktır: düğmeyi başka bir variant'a benzetir. CSS modülü sınıfı ihlaldir. Serbest olanlar: genişlik,
  flex/grid, hizalama, dış boşluk, yatay dolgu (`px-*`, `pl-*`), `text-left`,
  `whitespace-normal`, metin rengi, `hover:` / `disabled:` / `aria-*:` durum
  renkleri, durum tonu (`bg-destructive/10`), yüzen düğme gölgesi
  (`shadow-md`), `border-dashed`, `font-mono`, kart vurgu halkası
  (`hover:ring-2`), `before:` / `after:` dokunma alanı katmanı ve torun /
  kardeş seçicisi (`[&_svg]:`, `[&>svg]:`, `*:`) ile ikon boyutu. Öğenin
  kendisini seçen `[&]:` / `[&:not(:disabled)]:` sayılır. Satır içi bağlantı `size="inline"`, liste satırı / seçenek
  kartı / bırakma alanı `size="row"`, görsel karosu `size="tile"`. İstisna
  (tam ekran kamera deklanşörü, fotoğraf görüntüleyici şeridi, genel arama
  paleti satırı, kabuk arama alanı, pazarlama kiti alanı içindeki göster/gizle)
  gerekçesiyle `control-call-sites.test.ts` `EXCEPTIONS` listesindedir; `match`
  istisnayı dosyadaki tek etikete bağlar. `components/sections/` açılış
  sayfası bölümleri kapsam dışıdır; genel sayfaların ortak altbilgisi
  `sections/Footer.tsx` taranır. `TabsList` / `TabsTrigger` #854'te. Kör nokta:
  sabite çıkarılmış sınıf (`TILE`), `className`'i nesneden yayan
  `{...props}` ve `buttonVariants({ className })` çağrısı taranmaz — sabite
  boyut sınıfı yazılmaz, `className` JSX'te `cn(...)` ile verilir.
- `ToggleGroupItem` / `TabsTrigger` / `TabsList` üzerinde `!` ile yükseklik
  ezilmez (`h-7!`). Telefonda tek başına duran eylem düğmesi `default` ya da
  üstüdür; `sm/xs/compact` yoğun satır ve araç çubuğu içindir.
- `compact` yalnız yoğun yönetim tabloları ve araç çubukları içindir.
- Dekoratif kareler (avatar, ikon rozeti, görsel küçük resmi, tam ekran
  fotoğraf görüntüleyicinin kendi kontrolleri) kontrol değildir; bu matrisin
  kapsamı dışındadır.
- Ham HTML etkileşimli kontrol kullanılmaz. Form gönderimi için kullanıcıya
  görünmeyen `input[type="hidden"]` alanları ve bir `Button`'un tetiklediği
  gizli dosya seçici (`type="file"` + `className="hidden"`) istisnadır.

Matrisi `src/components/ui/control-sizing.test.ts`,
`src/components/ui/control-call-sites.test.ts` ve
`src/app/design/design-system.test.ts` CI'da bekçiliyor.
