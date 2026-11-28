# BakımX — tasarım dili

## Güncel kaynak: e-santral kalıbı (22 Kasım 2026)

22 Kasım 2026 kullanıcı kararıyla uygulama içi tasarımın kaynağı
**https://e-santral.com/bakimx** sayfasıdır (Apple tarzı, iOS gruplu liste dili).
Ayrıntılı kalıp, ölçüler ve bileşen tarifleri: [`docs/design-pattern-esantral.md`](./docs/design-pattern-esantral.md).
Bu bölüm aşağıdaki Attio kararlarıyla çeliştiği her yerde **onların yerine geçer**;
Attio bölümleri karar geçmişi olarak duruyor ve ekranlar taşındıkça budanacak.

- **Renk:** zemin `#f2f2f7` (gruplu), kart beyaz, mürekkep `#1d1d1f`, ikincil gri
  `#6e6e73`, çizgi `#e5e5ea`, birincil mavi **`#0071e3`** (metin tonu
  `--primary-strong` `#0058b0`). Durumlar pastel zemin + `-strong` metin.
- **Yazı:** sistem fontu (e-santral ile birebir yığın), gövde harf aralığı −0.01em.
  Telefonda iOS ölçeği (gövde 17px), masaüstü veri ekranlarında kompakt (15px).
  Ekran başlığı kalın, −0.03em.
- **Kontroller:** düğmeler hap; telefonda 44px, md+ 36px. Girdi 10px köşe
  (md+ 8px, `--control-radius`; karar 25-11, #878).
  Matris: [`docs/ui-control-sizing.md`](./docs/ui-control-sizing.md).
- **Yüzey:** kart 12px köşe (`--radius`), panel / KPI kartı 14px
  (`--radius-panel`); çerçeve yok ya da çok hafif; gölge yok. Kart/panel içindeki
  iç kutu 8px (`rounded-md`), onun içindeki 6px — iç köşe her zaman dıştan küçük.
  Diyalog ve mobil
  sheet 18px (`--radius-dialog`). Uygulama içi köşeler e-santral'in bir kademe
  altıdır (karar 25-11, #878); pazarlama yüzeyi `--mk-r-*` ölçeğinde kalır.
- **Birincil eylem:** mavi dolgu hap (`default`); ikincil düz bağlantı ya da
  `outline`; geri/kapat `ghost`.
- **Kabuk:** buzlu yarı saydam üst bar ve mobil sekme çubuğu, beyaz sidebar,
  mavi tonlu seçili öğe (`src/components/layout/app-shell.module.css`).
- İlk uygulama: Dashboard (`src/components/dashboard/surface.tsx`). Diğer
  ekranlar sırayla taşınır; her dilim kullanıcı teyidinden sonra.

---

# Karar geçmişi — Attio temelli tasarım dili (22 Kasım 2026 öncesi)

## Kapsam

12 Eylül 2026 tarihli kullanıcı geri bildirimleri önceki iki bölümlük denemenin yerini alır. Referans kullanıcının Attio ekran görüntüleri ve https://attio.com/. Ana sayfanın tamamı, üç ürün tanıtım sayfası, karşılaştırma, iki rehber, blog (liste + yazı), fiyatlar, demo, sistem durumu ve dört hukuki belge ortak `PublicSite` görünümünü kullanır. 13 Eylül 2026 tarihli kullanıcı kararıyla bu görsel dil yeni ve revize edilen bütün ekranlar için esastır: public site, kimlik doğrulama, kurulum, uygulama ve yönetim. Ekranın işlevi içerik yoğunluğunu belirler; pazarlama sayfasının büyük başlıkları ve geniş boşlukları veri ekranlarına taşınmaz. Public tasarımın yerel yönü kullanıcı tarafından onaylandı. Güncel revizyon kayıt ve üyelik sonrası kurulum ekranlarını kapsar. Production yayını kapsam dışıdır.

## Referanslar ve karar geçmişi

12 Eylül 2026 oturumlarında önce Cal.com değerlendirilmiş, ardından Attio görselleri ana referans olarak seçilmiştir. Aynı günün Vercel + Linear notları o tarihin destek malzemesidir; 27 Eylül 2026 itibarıyla uygulama kabuğunun kaynağı onlar değil, `app.attio.com/bakimx` üzerindeki canlı ölçümdür.

- Ana görsel referans: canlı Attio çalışma alanı (`https://app.attio.com/bakimx/home`, kayıt, liste, ayarlar, komut paleti, diyalog). Pazarlama sitesi `https://attio.com/` uygulama ekranlarına taşınmaz.
- 12 Eylül Vercel / Linear notları tarihçedir. Yeni uygulama yüzeyi o dosyalardan türetilmez.

BakımX'in tasarım dili Attio'dur: renk, düğme ölçüsü, kabuk ve bileşenler canlı `app.attio.com/bakimx` ölçümünden gelir. Başka sitenin buton, palet veya yoğunluk kuralı uygulanmaz. Mevcut shadcn/Radix ve erişilebilirlik kuralları geçerlidir. Call-site hex yazmaz; değerler token'a bağlanır.

## Uygulama kabuğu — canlı Attio, 26 Eylül 2026

Kaynak, 27 Eylül 2026 öğleden sonra `app.attio.com/bakimx` Home, Companies listesi, şirket kaydı Overview, hesap ayarları, komut paleti ve görev diyaloğu. Görünüm 1440×900. Pazarlama sayfalarının büyük H1’i ve 64–120px bölüm boşluğu bu ekranlara taşınmaz. Yazı tipi Inter. Gövde sıfırlaması 10px’tir; görünen metin kendi boyutunu taşır, BakımX gövdesi 10px yapılmaz.

### Kabuk — 27 Eylül 2026, Home ve Tasks

Ölçü kaynağı `app.attio.com/bakimx/home` ve Tasks sayfasındaki New Task düğmesi (Firefox kutu modeli).

- Üst bilgi bandı tam genişlik, **32px**, zemin `#266DF0`. Metin 14px / 500, satır 20px, beyaz, ortalı. Bant sidebar’ın da üstündedir; sidebar ve header onun altında başlar.
- Header bandın hemen altında, yükseklik **48px**, beyaz, alt çizgi 1px `#EEEFF1`. Solda 16px ikon + sayfa adı (14px / 600 / satır 20px / `#101112` / −0.07px), aralarında 8px. Sağda Help. Sayfa adı burada yaşar.
- Ana alanda breadcrumb ve sayfa adının ikinci kez yazılması yok. İçerik doğrudan araç çubuğu ve listeyle başlar.
- Sol sütun yaklaşık 275px. Çalışma alanı satırı header ile aynı hizada. Arama 28px, köşe 8px. Gezinme satırı 28px, köşe 9px. Seçili satır `rgba(0,0,0,0.04)`.
- Standart birincil düğme (New Task): dış kutu **28px**, köşe 8px. Dikey padding **4px**, sol **6px**, sağ **8px**. Metin satırı **20px** (14px / 500). İkon ile yazı arası **4px**. İçerik yüksekliği 20px kalır; 1px çerçeve bu 28px’in içine eklenmez.
- Arama kutusu 28px, köşe 8px, beyaz, nötr gölge. Kısayol rozeti 11px / 400, `rgba(0,0,0,0.5)`.
- Deneme bandı 32px, zemin `#266DF0`, bağlantı 14px / 500 beyaz.
- Karşılama 20px / 600 / satır 24px / `#101112` / letter-spacing −0.4px.
- Sayfa zemini `#FBFBFB`, kart beyaz, metin `#101112`. Hover zemini `#F6F7F7`. İnce ayırıcı `#EEEFF1` ve `rgba(0,0,0,0.06)`.

### Kayıt sayfası

- Sekmeler düğmedir, 28px, köşe 8px, padding 4px 8px, metin 14px / 500 / satır 20px / −0.07px. Seçili Overview: zemin `#FBFBFB`, iç çizgi `inset 0 0 0 1px #EEEFF1`, metin `#101112`. Seçilmemiş Activity: şeffaf, metin `rgba(0,0,0,0.63)`. Yalnız alt çizgi yoktur; seçili sekme nötr dolgu da alır.
- Kayıt başlığı ayrı ölçek: 16px / 600 (26 Eylül notu ve `#682` ölçümü). Bu turda başlık düğümü ayrıca doğrulanmadı.

### Liste satırı

- Companies hücresi 36px, beyaz, alt çizgi 1px `#EEEFF1`. İsim bağlantısı 24px; metin 14px / 500 / `#101112` / −0.07px.

### Komut paleti

- Beyaz panel 740×540px, köşe 12px (geçersiz — bkz. üst bölüm), gölge `0 0 0 1px rgba(0,0,0,0.07)`.
- Satır 36px, köşe 12px, metin 14px / 500 / `#101112`. Seçili satır zemini `#F6F7F7`.
- Alt eylem `Search records` 28px, köşe 8px, dolgu `#266DF0`, padding 4px 6px 4px 8px, birincil gölge.

### Diyalog

- Görev diyaloğu `role=dialog`, ölçülen dış kutu 808px genişlik, köşe 16px (geçersiz — bkz. üst bölüm). Gölge: `0 8px 28px -6px rgba(28,40,64,0.12), 0 18px 88px -4px rgba(28,40,64,0.16), 0 0 1px rgba(28,40,64,0.16)`.
- Başlık (`Edit task`) 15px / 700. Kapat, tarih, atama ve “Add record” 28px, köşe 8px, şeffaf, metin `rgba(0,0,0,0.55)`.
- `Cancel` beyaz 28px / 8px. `Save` 28px / 8px / `#266DF0` ve birincil gölge.

> **#1071 notu:** Ayarlar kabuğu artık e-santral kalıbını izler. Aşağıdaki Attio ölçümleri (`#FBFBFB` sütun, 28px satır, nötr aktif öğe, beyaz sağ yüzey, çerçeveli arama) **karar geçmişidir**; sidebar `app-shell.module.css` `.sidebar` ile (beyaz `--card`, 34px/15px satır, mavi ton aktif öğe, 13/600 grup başlığı, dolgulu arama hapı), içerik zemini global gruplu gri `--background` ile çizilir. Ayarlara özgü kalanlar: geri oku + başlık şeridi, iki grup, kilit rozeti, ortalı 768px sütun.

### Ayarlar

- Etiket alanın üstünde, 12px / 500, `rgba(0,0,0,0.5)`. Değer 14px / 500 / `#101112`.
- Select (saat dilimi ve haftanın başlangıcı) 32px, köşe 9px, yaklaşık 1px `rgba(0,0,0,0.06)`, metin 14px / 500 / 20px, iç dolgu solda 10px ve sağda 8px. Açılır liste tetikleyiciyle aynı genişlikte, köşe 12px ve 4px iç dolguludur. Seçenekler 32px yüksek, köşe 8px, 14px / 20px yazı ve yatay 8px dolgu kullanır. Liste gölgesi `0 0 0 1px rgb(28 40 64 / 4%), 0 4px 8px -4px rgb(28 40 64 / 12%), 0 4px 12px -2px rgb(24 41 75 / 16%)`. Liste tetikleyicinin altında ya da alanda yer yoksa üstünde açılır; seçili öğeyi tetikleyicinin üstüne bindiren konum kullanılmaz. Kaynak: 30 Eylül 2026, canlı `app.attio.com/bakimx/settings/account` DevTools ölçümü (`Start week on`).
- Textarea köşe 8px, padding 6px 10px, 14px / 500, gölge `inset 0 0 0 1px rgba(0,0,0,0.06)`.
- Planlar: üstte mevcut paket şeridi, altta karşılaştırma tablosu. Kart ızgarası yok.

#### Ayarlar sayfalarının ortak yerleşimi — 27 Eylül 2026, #673 takip işi

Kaynak: `https://app.attio.com/bakimx/settings/account`; Zen geliştirici araçları ile `getBoundingClientRect()` ve `getComputedStyle()` ölçümü, ayrıca kullanıcının Firefox F12 ekran görüntüsü. Aşağıdakiler CSS pikselidir; ekran görüntüsünün tarayıcı ölçeği fiziksel piksel sayısını değiştirebilir.

- Ayarlar için sol gezinme sütunu ölçülen görünümde **275px**; sağ panel kendi içinde kayar. Üstteki duyuru bandı 32px, hemen altındaki sayfa başlığı şeridi 48px. Sol sütunda başlık, arama alanı, ardından Kişisel / Çalışma alanı grupları bulunur. Arama alanı 28px yüksekliğindedir; seçili satır nötr dolgu alır.
- Sağ içerik yüzeyi beyazdır. İçerik kabının yatay dolgusu **24px**, içerideki form sütunu `max-width: 768px` ve yatayda ortalıdır. Bu sütunun üst/alt dolgusu **72px**; büyük ekranda içerik kenardan kenara uzatılmaz. BakımX mobil uyarlamasında çevre boşluğu 16px olur, form sütunu mevcut genişliğe iner.
- Profil başlığı ve kısa açıklama form sütununun başındadır. Ardından tam genişlikte sakin bilgi şeridi, avatar + kimlik satırı, iki sütunlu Ad/Soyad, tam genişlikte e-posta alanı ve sonraki tercih/güvenlik bölümü gelir. İncelenen sayfadaki `768px` form satırında iki alan **376px** genişliğinde ve aralarında **16px** boşluk vardı; kontrol dış yüksekliği **32px**, iç metin **14px**. Etiketler kontrollerin üstündedir.
- Bölümler kart yığınına veya dış çerçeveli büyük bir profile paneline alınmaz. Hiyerarşi beyaz yüzey, 24–40px bölüm aralıkları, küçük etiketler ve nötr bilgi alanıyla kurulur. Mobilde iki sütun tek sütuna düşer; avatar ve kimlik bilgisi doğal akışta kalır.
- BakımX uyarlamasında Attio'nun mevcut olmayan avatar yükleme, e-posta değiştirme, saat dilimi ve kişisel bağlam işlevleri taklit edilmez. Mevcut ad/soyad kaydetme, kimlik kopyalama ve şifre değiştirme davranışı bu düzene yerleştirilir. Yeni bir ayar gerekiyorsa gerçek veri ve kaydetme sözleşmesiyle ayrı geliştirilir.
- Bu kabuk **bütün `/settings/*` ekranlarında** ortaktır: beyaz sağ yüzey, ortalı `max-width: 768px` içerik, masaüstünde üstte toplam 72px boşluk ve aynı başlık/açıklama aralığı. Sayfaların içerdiği form, ekip listesi, paket karşılaştırması ve ödeme geçmişi kendi davranışını korur; geniş tablolar içerik sütunu içinde yatay kayar. Eski `AppShell wide` çağrıları ayarlar rotasında genişliği değiştirmez.

#### Ayarlar sol sütunu — 27 Eylül 2026 canlı CSS ölçümü

Kaynak: aynı Attio hesabında Zen geliştirici araçları Console ile `getBoundingClientRect()` ve `getComputedStyle()`; kullanıcı Firefox Inspector ekran görüntüleriyle de karşılaştırıldı.

- Attio'da ölçülen masaüstü sütun genişliği **275px**, zemin `#FBFBFB`, kenar çizgisi `#EEEFF1`. BakımX'te `/dashboard` ve bütün `/settings/*` rotaları aynı `SidebarProvider` genişliğini ve kaydedilmiş yeniden boyutlandırma tercihini kullanır (varsayılan **256px**). Ayarlar için ayrı genişlik uygulanmaz; sağ ana içerik sütununun dolgusu ve `max-width: 768px` sınırı ayarlara özeldir. Üst sayfa başlığı da ortak kabukta, rotanın gezinme ikonu ve başlığıyla gösterilir.
- Başlık şeridi **49px** yükseklik, `12px` sol ve `40px` sağ iç boşluk, altta 1px ayraç. Geri bağlantısı yalnız ikon taşıyan **28×28px** ghost kontroldür (`8px` köşe); **Ayarlar yazısı bağlantının dışında ayrı öğedir**. Aralarında **12px** vardır. Yazı Inter **16px / 600 / 20px / −0.16px**, `#101112`.
- Arama şeridi 49px; yatay 12px, üst 10px / alt 11px dolgu. Alan **28px** yüksek ve 8px köşe; yazı 14px / 500 / 20px / −0.07px. Arama ikonuyla metin ayrı öğelerdir.
- Grup başlığı satırı 28px; etiket **12px / 500 / 16px** ve siyahın yaklaşık %63 tonu. Gezinme satırı **28px**, yatay 8px dolgu, ikon/metin arası **6px**, köşe **9px**; metin 14px / 500 / 20px / −0.07px. Satırlar arasında 1px boşluk; seçili satır `rgba(0,0,0,0.04)` dolgu alır.

### Düğme ölçüleri

Yeni ve revize edilen düğmeler bu tablodur. Eski 38/44/48px koyu dolgu sözleşmesi kalkmıştır.

| Attio kontrolü | Yükseklik | Köşe | Dolgu |
| --- | --- | --- | --- |
| Kompakt birincil (Keep Pro) | 20px | 6px | `#266DF0`, yazı 12px / 500 beyaz |
| Kompakt ikincil (Edit) | 20px | 6px | beyaz + nötr gölge, yazı 11px / 500 |
| Standart birincil (Upload, Save) | 28px | 8px | `#266DF0` |
| Ghost (Help) | 28px | 8px | şeffaf, 14px / 500, `rgba(0,0,0,0.55)` |
| İkon birincil | 28×28 | 8px | `#266DF0` |

Birincil gölge: `inset 0 0 0 1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(38,109,240,0.12), 0 3px 6px -2px rgba(38,109,240,0.08)`. Nötr gölge: `0 0 2px rgba(28,40,64,0.18), 0 1px 3px rgba(0,0,0,0.04)`.

Attio durum renkleri, referans olarak: başarı `#02AD6E` / `#00D17E`, tehlike `#EB3B3B` / `#FF5454`, uyarı `#CF8300` / `#F97514`. BakımX semantik tokenları (`success`, `warning`, `destructive`) bunların yerine geçmez; call-site hex yazmaz.

### Buton rengi

Birincil dolgu `#266DF0`, yazı beyaz. İkincil beyaz zemin ve nötr gölge. Üçüncül şeffaf, metin `rgba(0,0,0,0.55)`. `navy` ve `foreground` dolgu artık birincil CTA değildir.

Yeni veya revize edilen uygulama ekranları bu kabuğa uyar. Tüm sayfaları tek geçişte boyamak bu notun kapsamı dışındadır.

## Görsel dil

Inter uygulama ve genel public yüzeylerde kullanılır. Kod ve sabit genişlikli alanlarda Geist Mono korunur. Blog (`/blog`) display tipografi için **Switzer** kullanır (PP Radio Grotesk referansına yakın Fontshare alternatifi; ITF FFL, yerel WOFF2 dosyaları). Beyaz `card` zemin; ince `border` ayraçlar; koyu `foreground` başlıklar; `muted-foreground` açıklamalar. Mavi, ürün verilerinde ve bağlantılarda vurgu olarak kalır. Büyük renk blokları açık yüzeylere dönüştürülür. Ortak içerik sınırı 1200px, ürün sahnesi 1440px. Bölüm boşlukları masaüstünde 64–120px, mobilde 64px. Ana H1 84px'e, tanıtım sayfaları 76px'e kadar ölçeklenir. Başlıklarda sıkı harf aralığı ve dengeli satır kırılması kullanılır. Rehber ve hukuki metinlerin içerikleri korunur.

`PublicSite` ve CSS Module yalnız açıkça sarılmış site sayfalarına uygulanır. Uygulamanın global tokenları veya paylaşılan UI bileşenlerinin varsayılanları değiştirilmez. Header/Footer ortak açık görünüm kullanır. Mobil ürün görselleri dikey sıralanır; CTA'lar dar alanda alt alta gelir.

## Design Palette — 17 Eylül 2026

Canlı önizleme: [`/design`](/design) (yerel `http://localhost:3001/design`; ileride `ui.bakimx.com` adayı). Galeri düzeni [getdesign.md / Linear preview](https://getdesign.md/linear.app/design-md) yapısını izler (01 Palette → 08 Responsive); token değerleri BakımX’e aittir. Yeni UI işi buradaki sözleşmeye uyar.

### Colors

Hex değerleri yaklaşıkdır; kaynak `src/app/globals.css` (oklch + marka sabitleri). Call-site’ta sabit hex yazılmaz — token sınıfı kullanılır.

| Token | Hex (yaklaşık) | Rol |
| --- | --- | --- |
| `navy` | `#071F49` | Eski koyu CTA. Yeni birincil düğmede kullanılmaz |
| `navy-foreground` | `#FFFFFF` | Navy üzeri metin |
| `brand` | `#2F84FF` | Marka aksanı (grafik / vurgu) |
| `primary` | `#266DF0` | Birincil düğme, bağlantı, seçim, odak. Eski `#0C65E8` hedef değildir |
| `primary-strong` | `#004DCF` | Tonlu `bg-primary/10` üzeri metin |
| `foreground` | `#101112` | Ana metin. Düğme dolgusu değil |
| `muted-foreground` | `#262626` | Yardımcı metin |
| `muted-foreground-strong` | `#171717` | Tonlu yüzeylerde yardımcı metin |
| `background` | `#F7F8FA` | Sayfa zemini |
| `card` | `#FFFFFF` | Kart / panel |
| `muted` | `#EDF2F8` | İkincil yüzey, hover |
| `border` / `input` | `#DCE2E8` | 1px ayraç |
| `success` / `-strong` | `#189A30` / `#007200` | Başarı durumu |
| `warning` / `-strong` | `#D19200` / `#874B00` | Uyarı durumu |
| `destructive` / `-strong` | `#E7000B` / `#BF0000` | Hata durumu |
| `whatsapp` | `#25D366` | WhatsApp aksiyonu (bilinçli AA istisnası) |

### Typography

| Seviye | Font | Boyut | Ağırlık | Not |
| --- | --- | --- | --- | --- |
| App / public body | Inter | 14–16px | 400–500 | Genel UI |
| App başlık | Inter | 28–36px | 600 | Form / dashboard |
| Marketing H1 | Inter | ~76–84px | 600 | Sıkı tracking |
| Button | Inter | 14px | 500 | lh 140%, tracking −0.02em |
| Blog display | Switzer | — | — | Yalnız `/blog` |
| Code / mono | Geist Mono | 13px | 400 | Kod / plaka benzeri |

### Rounded (zorunlu skala)

> **Karar geçmişi — geçersiz (#878, #898).** Güncel ölçek: bu dosyanın başındaki "Güncel kaynak" bölümü ve `docs/ui-control-sizing.md` → "Köşe yarıçapı" / "İç içe köşe". Aşağıdaki tablo (sm=6 kontrol, lg=10 yüzey) artık uygulanmaz; yalnız `rounded-2xl/3xl` yasağı sürüyor (`design-system.test.ts`).

Kontrol yüzeyi ile kart/panel köşeleri bilerek ayrılır. Yeni işte bu skala dışına çıkılmaz.

| Token | px | Tailwind | Kullanım |
| --- | --- | --- | --- |
| `none` | 0 | `rounded-none` | Tablo hücresi, ayraç |
| `xs` | 4 | `rounded-xs` | Küçük chip (nadir) |
| `sm` | **6** | `rounded-sm` | **Kontrol:** Button, Input, Textarea, Select tetikleyici |
| `md` | 8 | `rounded-md` | Menü satırı, toast içi |
| `lg` | **10** | `rounded-lg` | **Yüzey:** Card, Dialog, Sheet, Alert, Popover |
| `xl` | 12 | `rounded-xl` | Büyük panel üst sınırı |
| `full` | 9999 | `rounded-full` | Avatar, pill Badge — yalnız bilinçli |

- Shared `Button` köşesi yüzeye göre 6px (kompakt) veya 8px (standart). *(geçersiz — bkz. üst bölüm)*
- `rounded-2xl` / `rounded-3xl` / `rounded-4xl` yeni işte yasaktır (FAB / özel şekil hariç, gerekçeli).
- CSS Module’ler (kayıt, public) kendi sınıflarında aynı px değerlerini kullanır; paralel “gölge palet” üretmez.

### Bileşen disiplini

- İnteraktif öğeler shadcn/Radix (`components/ui/*`) üzerinden gelir; ham `<button>` / `<input>` yok.
- Durum kutuları ad-hoc border+ikon değil `<Alert variant="…">` kullanır.
- Call-site’ta `h-*` / `rounded-*` / hex override yerine `size` / `variant` / token sınıfı tercih edilir.

### Site genelinde hizalama — 17 Eylül 2026 (geç)

Palette sözleşmesi public / auth / billing / app / admin yüzeylerine uygulandı:

- Panel/kart `rounded-2xl` / `3xl` / `rounded-[20px]` → `rounded-xl` veya `rounded-lg` (üst sınır 12px — geçersiz, bkz. üst bölüm). İstisna: `Badge` pill, avatar/`rounded-full`, bilinçli chip.
- Marketing SEO + rehber sayfalarında `shadow-primary/*` ve `hover:border-primary/40` kaldırıldı; gölge `shadow-md`, hover `hover:bg-muted/60`.
- Public hero figure 18px → 12px; mac-window 14px → 12px; fiyat kartları 20px → `xl`.
- Auth Input `rounded-md` override → `rounded-sm`; force/set-password ve register başarı kutuları `<Alert>`.
- Paywall / upsell / Trust adımlarında parlak `bg-primary` dekoratif dolgu → `muted` / `navy` / açık card.
- App hata/uyarı şeritleri (iş emri, randevu, teklif, hatırlatma, ekip) `<Alert>`e çekildi.
- Canlı destek ajan balonu `bg-primary` → `bg-navy` (sohbet sözleşmesi).

Regresyon: `src/app/design/design-system.test.ts` `rounded-2xl`/`3xl` tarar (Badge hariç).

## Site genelinde metin rengi — 13 Eylül 2026

Kullanıcının Header için onayladığı koyu metin kararı tüm siteye genişletildi: public, blog, kayıt, kurulum, uygulama ve yönetim. 13 Eylül’de bu karar Vercel’in nötr metni ve Linear’ın hiyerarşisiyle gerekçelenmişti. Güncel kaynak Attio ölçümüdür: ana metin `#101112`, yardımcı metin saydam siyah (`rgba(0,0,0,0.5)` – `0.63`). BakımX tokenları `foreground` / `muted-foreground` olarak kalır; call-site hex yazmaz.

- Açık temada ana metin, başlık, navigasyon ve alan etiketleri `text-foreground` kullanır: `#171717`. Kart, popover, secondary ve accent metinleri aynı nötr siyah tonundadır.
- Yardımcı metinler `text-muted-foreground` kullanır: `#262626`; soluk gri görünüm yerine siyaha yakın okunaklı ton. Tonlu yüzeylerde `text-muted-foreground-strong` (`#171717`) kullanılır.
- Hiyerarşi öncelikle font boyutu, ağırlık, satır yüksekliği ve boşlukla kurulur; metne opacity verilmez. Menü etiketleri yardımcı metin sayılmaz.
- Bu açık kullanıcı talebi, global tokenları değiştirmeme kuralının **nötr metin paleti için istisnasıdır**; renkler `globals.css` üzerinden uygulanır. Call-site'larda sabit hex renk kullanılmaz.
- Koyu tema açık metinlerini, koyu dolgu üzerindeki açık yazılar kendi foreground eşlerini korur. Marka, bağlantı, odak, başarı/uyarı/hata renklerinin anlamı korunur.
- Inter genel fonttur; `/blog` ve yazı sayfalarında Switzer, sabit genişlikli alanlarda Geist Mono korunur.

## Eylemler ve butonlar (zorunlu)

27 Eylül 2026 kararı: her yüzeyde (public, asistan, kayıt, kurulum, uygulama) birincil eylem Attio mavisidir. Eski koyu `navy` / `foreground` CTA kuralı kalkmıştır.

| Rol | Nasıl | Ne kullanılmaz |
| --- | --- | --- |
| Birincil eylem (gönder, kaydet, başlat, ana CTA) | `#266DF0` dolgu, beyaz yazı, birincil gölge. Standart 28px / köşe 8px. Sıkışık şerit (Keep Pro) 20px / köşe 6px / yazı 12px. | `navy` veya `foreground` dolgu; gradient; 38px ve üzeri eski yükseklik |
| İkincil eylem | Beyaz zemin, nötr gölge, köşe 6px (20px) veya 8px (28px) | Mavi çerçeve, `hover:border-primary/40` |
| Üçüncül / geri / kapat | Şeffaf, 28px, köşe 8px, metin `rgba(0,0,0,0.55)` | Renkli zemin |
| Bağlantı ve odak | Aynı mavi, `#215BC4` koyu ton | Birincil düğmeyi başka renge çekmek |
| Durum | Yalnız gerçek durum: başarı `#02AD6E`, tehlike `#EB3B3B`, uyarı `#CF8300` | Dekoratif renkli header |

Ek kurallar:

- Metinli standart düğme: Inter 14px / 500 / satır 20px / letter-spacing −0.07px. Yazı ortalanır; mavi dolguda yazı beyazdır.
- İkon birincil 28×28, köşe 8px, aynı mavi ve birincil gölge.
- Panel başlığı açık karttır. Diyalog köşesi 16px (geçersiz — bkz. üst bölüm), gölge kabuk bölümündeki diyalog ölçüsüdür.
- Köşe (geçersiz — bkz. üst bölüm): kompakt kontrol 6px, standart kontrol 8px, menü satırı 9px, palet paneli 12px, diyalog 16px. `rounded-2xl` ve üzeri yeni işte yok (pill avatar/rozet hariç).
- Radix `asChild`, disabled, odak halkası ve hata durumları korunur. Boyut `size` ile verilir; call-site’a `h-*` kopyalanmaz.
- Mevcut `Button` varyantları bu sözleşmeye göre güncellenene kadar yeni ekran Attio ölçüsünü kullanır. Eski `variant="navy"` çağrıları revizyonda birincil maviye çekilir.

## Uygulama, kayıt ve kurulum

- Çalışma alanı menüsü mevcut şube üyeliklerini, hesap/çalışma alanı ayarlarını, yetkili kullanıcı için daveti ve çıkışı toplar. Ayarlara girince ana gezinmenin yerini geri düğmeli, aranabilir ayarlar menüsü alır. Hesap ayarlarının giriş adresi `/settings/account`tır.
- Uygulama kabuğunda gerçek deneme durumu varsa mavi bilgilendirme bandı masaüstünde de en üstte görünür. Çalışma alanı adı sidebar başlığında tek satırdır; genel arama ve bildirimler sidebar'da yan yanadır. Üst header sayfa başlığını taşır; genel oluşturma ve kullanıcı menüsü burada tekrarlanmaz. Mobil teknisyen bildirimleri sidebar kapalıyken de çalışabilmesi için üst şeritte erişilebilir kalır.
- Uygulama ve ayarlar sidebar'ında Attio'nun yayımlanan Inter tipografi ölçeği kullanılır: çalışma alanı adı ve header 16/20 semibold, ana satırlar ile menü/arama sonuçları 14/20 medium, bölüm etiketleri 12/16 medium. Sidebar genişliği yazı boyutunu değiştirmez. Search tıklaması ve ⌘/Ctrl+K aynı komut penceresini açar. Pencere sayfa/özellik ve hızlı işlem aramasını, ayrıca mevcut müşteri, araç ve iş emri kayıtlarını bir araya getirir; kayıt sonuçları atölye ve rol sınırlarını korur.
- Açık `card` yüzey, `border` ile 1px ayraçlar ve `foreground` başlıklar temel düzeni oluşturur. Yardımcı metin `muted-foreground` kullanır. Dekoratif renkli kart yığınları ve büyük koyu arka plan panelleri yerine hizalama ve boşlukla hiyerarşi kurulur.
- Inter kullanılır. Form ve uygulama başlıkları yaklaşık 28–36px, alan etiketleri ve gövde 14–16px, yardımcı metin en az 12px olur. Pazarlama başlık ölçeği bu ekranlara uygulanmaz.
- Boşluklar 4/8px ritminde; alan araları 16–24px, mantıksal bölüm araları 24–32px. Form kontrolleri 28px (select 32px), köşe 8px. Tablo satırı 36px. Diyalog köşesi 16px. (Köşe değerleri geçersiz — bkz. üst bölüm.)
- Birincil / ikincil / üçüncül eylem ayrımı yukarıdaki **Eylemler ve butonlar** tablosuna uyar. Hata, başarı ve uyarı renkleri yalnız gerçek durumu anlatır; kontrast kuralları korunur.
- Kayıtta yalnız sağdaki form alanı kayar; Header, sol açıklama sütunu ve alt footer görünüm alanında sabit kalır. Kayıt mevcut public `Header` bileşenini kullanır; açıklama sütununda logo tekrar edilmez. Kayıt masaüstünde sakin bir açıklama sütunu ve hesap formundan oluşur; mobilde form önceliklidir. Firma, iletişim ve giriş bilgileri ince ayraçlarla gruplanır. E-posta doğrulaması, KVKK, danışman/referans ve paket sözleşmeleri korunur.
- Sektör, iş detayları, ekip ve modül seçimleri üyelik sonrası dört adımlı kurulumda gösterilir. Seçenekler düzenli nötr yüzeylerde, seçili durum açık ve klavyeyle erişilebilir sunulur. 16 Eylül 2026 URL tabanlı kurulum kararı aşağıda bu ekranın kabuğunu ayrıca tanımlar.
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

Önizleme http://localhost:3001. Karşılaştırmalar `artifacts/issue-635/public-site/` altında. Önceki denemeler korunur. Bu çalışma kayıt dönüşümüne ilişkin ölçüm veya iddia içermez.

## Kurulum ekranı — 16 Eylül 2026 (#661)

Kullanıcının paylaştığı Attio üyelik sonrası ekranları kurulumun yeni yapısal referansıdır. Bekleyen iş yeri sahibi dashboard modalı yerine `/onboarding/sektor`, `/onboarding/is-detaylari`, `/onboarding/ekip` ve `/onboarding/moduller` adreslerini sırayla görür. Üstte marka, ortada odaklı iki sütunlu kart, solda tek adımın formu ve altta ileri/geri eylemleri, sağda BakımX ürün önizlemesi, altta kısa hukuki bağlantılar bulunur. Dar ekranda önizleme gizlenir ve form doğal sayfa kaydırmasını kullanır.

Attio'nun sayfa oranları ve adım akışı yapısal referanstır; yüzeyler bu belgedeki açık Attio kabuğunu kullanır: `background` sayfa, `card` form ve ürün çerçevesi, ince `border`, sınırlı gölge, `foreground` başlık ve `muted-foreground` yardımcı metin. Tam ekran koyu tema veya büyük koyu önizleme bloğu kullanılmaz. İlk adımda etkin sektörler doğrudan görünür; henüz açılmamış sektörler ikincil bir açılır bölümde kalır. Birincil kurulum eylemi Attio mavisi `#266DF0`, 28px, köşe 8px kullanır. Seçimler adımlar arasında ve aynı tarayıcıdaki yenilemede korunur; API, plan ve yetki sözleşmeleri değişmez.

## 13 Eylül geliştirme uzlaştırması

Ana sayfadaki bağımsız “Canlı Demo / Ruhsat Okuma” bölümü kaldırılmıştır; tekrar eklenmez. Hero altındaki etkileşimli ProductStage ve “Birlikte inceleyelim” modalı korunur. Güncel yerel önizleme http://localhost:3001 adresindedir.

Footer sırası kolonlar → copyright → dekoratif BakımX watermark’tır; çözüm kolonlarında kategori başlıkları ve sayfa bağlantıları bulunur. Çerez tercihleri mobilde sağ alttaki asistan ve yukarı çık düğmelerinin üstünde yer alır. Eski reklam/click-ID entegrasyonu taslağı bu teslimata dahil değildir.

## Demo reklam taslağı uzlaştırması — 15 Eylül 2026 (#649)

Kullanıcı eski reklam/click-ID taslağını ayrı dev PR kapsamında yeniden değerlendirmeyi onayladı. `/demo` ve yazdırılabilir `/demo/ozet` açık PublicSite yüzeylerini, mevcut demo formunu ve onaylı ürün mesajlarını kullanır. Eski koyu bloklar ve doğrulanmamış “maksimum 10 saniyede parça bulma” garantisi taşınmaz. Reklam atfı ve demo dönüşümü yalnız analitik ana anahtarı açıkken ve hedefleme çerezlerine açık rıza varken çalışır. İletişim bilgileri, hash’leri veya CRM kimlik/aşama bilgileri reklam sağlayıcılarına gönderilmez. Lite kampanya atfı ayrı kalır. Dış sağlayıcı aktarımı yalnız Google Ads demo dönüşümüdür; Meta Pixel/CAPI yüklenmez, rızalı fbclid yalnız dahili atıfta saklanır.

## Canlı Attio bileşen kararı — 27 Eylül 2026 (#682)

Kullanıcının Overview/Activity, Highlights kartları ve New meeting görselleri ile canlı DevTools ölçümleri yeni ortak bileşen referansıdır. [Ölçüm ve uygulama kaydı](docs/attio-live-design-audit.md). Bu bölüm önceki “aktif sekmede dolgu yok”, 28–36px uygulama başlığı, #262626 yardımcı metin ve bütün yüzeylerde 10px köşe kurallarının yerini alır. Kullanıcının site geneline uygulama talebi bu bileşen/token değişikliklerini açıkça kapsar.

- Sekme: Inter 14/20, 500; 28px kontrol, 8px köşe; seçili durumda ince çerçeveli nötr yüzey **ve** ayrı 1px alt çizgi. `TabsList variant="line"`; seçenek grupları için segmented `default` korunur.
- Tipografi: genel gövde 14/20, bölüm etiketi 12/16, kayıt başlığı 16/20, uygulama sayfa başlığı 20/28 (`text-page-title`). Public display ve blog editoryal ölçekler kendi rollerini korur. Mevcut Inter fontu kullanılır.
- Kart: `Card` 12px köşe, ince border, gölge yok. `HighlightCard` etiketi 12px, değeri 14px; ikon opsiyonel. Dashboard/listelerde kocaman sayı ve aynı değeri tekrar eden badge kullanılmaz.
- Modal: `Dialog`/`AlertDialog` 16px köşe (`--radius-dialog`, yalnız bu yüzeyler için istisna), ince dış çerçeve, yumuşak katmanlı gölge (`--shadow-dialog`), beyaz başlık/gövde/footer. Başlık 14px, eylemler sağ altta; mobilde sığmazsa içeride kaydırma. Arka yüzey hafifçe örtülür, blur yok. Reduced motion tercihinde animasyon yok.
- Nötr yardımcı metin `#60646c`; açık zeminlerde AA kontrastı korunur. Tonlu yüzeylerde `-strong` kuralları geçerlidir. Marka ve semantik renkler korunur. Kontrol köşeleri ve mevcut CTA renk politikası bu çalışmada değişmez.
- `/design#cards` ortak sekme, 3×2 özet kartı ve minimal modalın çalışan örneğidir. Örnekler gerçek müşteri kaydı oluşturmaz.
