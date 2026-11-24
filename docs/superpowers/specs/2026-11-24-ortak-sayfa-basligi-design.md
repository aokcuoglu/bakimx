# Ortak sayfa başlığı çerçevesi — Tasarım

**Tarih:** 2026-11-24
**Issue:** [#823](https://github.com/aokcuoglu/bakimx/issues/823)
**Durum:** Onaylandı (2026-11-24) — uygulama planı bekliyor

## Niyet

Kullanıcı `/dashboard` ile `/orders` arasında geçerken "Yeni Araç Kabul"
düğmesinin farklı yerde durduğunu ve geçişin yavaş hissettirdiğini gördü.
İsteği şu: uygulama içindeki sayfalar ortak bir iskeleti paylaşsın.
**Breadcrumb ve standart düğmeler her sayfada aynı yerde dursun.** Sayfaya
özel içerik de ortak bir çerçevenin içine yerleşsin. Sayfa değişirken bu sabit
parçalar yerinden oynamasın ve geçiş hızlı olsun.

Atölyeler uygulamayı çoğunlukla telefondan kullanıyor. Sabit parçaların yerinden
oynaması "uygulama takıldı" hissi veriyor, aranan düğmenin her sayfada farklı
yerde olması da kas hafızasını bozuyor.

## Bugünkü durum (ölçüldü)

- **Düğme neden kayıyor:**
  - İki sayfa da `surface.hero` sınıfını kullanıyor
    (`src/components/dashboard/surface.module.css`).
  - Genel Bakış'ta başlığın altında tarih/karşılama satırı var ve `.hero`
    ≥640px'te `align-items: flex-end`. Düğme bu yüzden alt satırın hizasına,
    yaklaşık 35px aşağı iniyor.
  - Genel Bakış ayrıca `surface.root` içinde (en fazla 1440px, ortalı), Araç
    Kabulleri değil (tam genişlik). Geniş ekranda düğme yatayda da kayıyor.
- **Başlık için 4 farklı kalıp var:**
  1. Genel Bakış hero'su (alt satırlı).
  2. Araç Kabulleri hero'su (alt satırsız).
  3. `AppShell`'in masaüstünde çizdiği `text-page-title` h1'i, içerikte de ayrı
     bir "sayı + düğmeler" satırı (Müşteriler, Teklifler, Kasa…).
  4. `pageActions` ile telefonun üst barına giden "+" ikonu (Araçlar, Randevular).
  - Bazı sayfaların "Yeni …" düğmesi istemci liste bileşeninin içinde:
    `parts-list.tsx`, `suppliers-list.tsx`, `reminder-list.tsx`.
- **İstisna kümeleri:** `app-shell.tsx` başlığın nerede çizileceğine dört
  yol-kümesiyle karar veriyor: `CONTENT_H1_PATHS`, `OWN_TITLE_MENU_PATHS`,
  `BAR_TITLE_ONLY_PATHS`, `MOBILE_CONTENT_HEADING_PATHS`.
- **Breadcrumb:** uygulamada hiç yok. shadcn `breadcrumb` bileşeni de kurulu değil.
- **Geçişteki kayboluş:**
  - Sayfa geçişinde `loading.tsx` (`PageLoading`) başlık dahil tüm içerik
    alanını spinner'la değiştiriyor, düğmeler kaybolup geri geliyor.
  - Next.js 16 dinamik rotalarda `loading.tsx` varsa yükleme ekranını önceden
    getirir ve tıklanınca anında gösterir, ortak layout'u da yerinde tutar
    (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`).
    Yükleme ekranı başlığı da çizerse geçişte başlık hiç kaybolmaz.
- **Hız:**
  - Lokalde iki sayfa da tam yüklemede yaklaşık 0,9 sn sürüyor. Bunun büyük
    kısmı ortamdan geliyor: dev modu ve tünel üzerinden AWS dev DB, sorgu başı
    yaklaşık 80 ms.
  - Ortamdan bağımsız sorun: `/orders` tüm kayıtları limitsiz çekiyor (yaklaşık
    450 KB HTML). Bu, bu işin kapsamı dışında (aşağıda).

## Hedefler

1. Tek bir `PageHeader` bileşeni, üç satırlı:
   - **Breadcrumb satırı.**
   - **Başlık satırı:** solda başlık, sağda standart düğmeler. Düğmeler başlık
     satırına hizalı, alt satır onları itmez.
   - **İsteğe bağlı alt satır:** sayı, tarih, bağlam.
2. **Tek bir rota kaydı.** Her sayfa için bölüm, başlık ve standart düğmeler
   tek yerde durur. Düğmeler paket (`hasFeature`) ve yetki (`actorCan`)
   kapılarına uyar.
3. **Ortak içerik çerçevesi.** Tüm sayfalarda aynı en geniş ölçü, aynı yatay
   hizalama, başlık ile içerik arasında aynı boşluk.
4. **Geçişte başlık kaybolmaz.** Yükleme ekranı başlığı rota kaydından çizer.
   Tıklanınca yeni sayfanın breadcrumb'ı, başlığı ve standart düğmeleri anında
   yerinde görünür, yalnız içerik alanında yükleme göstergesi döner.
5. **Breadcrumb her sayfada.**
   - Üst seviye: `Bölüm › Sayfa` (ör. `Servis › Araç Kabulleri`).
   - Menü alt öğesi: `Depo & Finans › Kasa › Tahsilatlar`.
   - Alt sayfalar ileride tam yolu gösterir (Takip).

## Kapsam (bu dilim = #823, tek PR)

Sol menüdeki tüm üst seviye sayfalar ve menü alt öğeleri:

- **Ana Panel:** `/dashboard`
- **Servis:** `/orders`, `/customers`, `/vehicles`, `/quotes`,
  `/appointments`, `/calendar`, `/reminders`, `/smart-capture/registration`
- **Depo & Finans:** `/parts`, `/purchases`, `/bakimx-orders`, `/suppliers`,
  `/cashbox`, `/cashbox/payments`, `/cashbox/aging`
- **Analiz:** `/analytics`, `/reports`
- **İletişim:** `/communications`

## Kapsam dışı / karşı-hedefler

- **Kapsam dışı:**
  - **Teknisyen (sidebar'sız) ekranları:** `/technician`, `/technician/*`,
    `?from=technician` akışı. Kendi odaklı düzenleri var. Kayıtta "Servis"
    altında görünse de dokunulmaz.
  - **Ayarlar:** kendi sol menülü düzeni var; breadcrumb'ı Takip'te.
  - **Alt sayfalar:** detay, yeni, düzenle, `/reports/*`, `/customers/balances`,
    billing. Kayıt adlı breadcrumb ve İş Emri `DetailHeader`'ının çerçeveye
    taşınması Takip'te. Bu dilimde dokunulmaz.
  - **Sorgu performansı:** `/orders` limitsiz sorgusu ve diğer veri tarafı
    hızlandırmaları ayrı issue olacak.
  - **Next.js 16 Cache Components (PPR):** uygulama genelinde bayrak gerektirir,
    ayrı değerlendirme.
- **Karşı-hedefler** (teknik olarak çalışsa bile başarısızlık sayılır):
  - **Geçişte kayma.** Sayfa yüklendiğinde başlık satırının ya da düğmenin
    kayması: veri gelince metin değişmesi, satır eklenmesi, yükseklik oynaması.
    Veriye bağlı kısımların yeri baştan ayrılır.
  - **Çift başlık.** Telefonda üst barda ve içerikte aynı başlığın iki kez
    görünmesi.
  - **Gizli eylem.** Bugün görünen bir eylemin kaybolması. Taşınan her düğme
    çerçevede ya da sayfa içinde yerini korur.
  - **Kapı atlatma.** Paket veya yetki kapısının istemci kaydına taşınırken
    gevşemesi. Sunucu tarafı kapılar (`requireWritableWorkshop`) aynen kalır;
    kayıt yalnız görünürlüğü yönetir.

## Kısıtlar

- **UI kuralları:**
  - e-santral kalıbı (`DESIGN.md`, `docs/design-pattern-esantral.md`) ve
    `docs/ui-control-sizing.md`: telefonda 44px, md+ 36px kontrol.
  - Hap düğme, birincil mavi `default`, semantik renk token'ları.
  - shadcn primitive'leri (`<Button asChild><Link/></Button>`).
  - `cn()` `text-page-title` gibi özel sınıfları siler; düz `className` kullan.
- **Next 16:** `params`/`searchParams` Promise'tir. Sayfalar sunucu bileşeni
  kalır; `AppShell` ve `PageHeader` istemci bileşenidir.
- **Kaynak tarayan kapılar:** `src/lib/ui-contract.test.ts`,
  `src/lib/theme-tokens.test.ts`, `src/components/ui/control-sizing.test.ts`
  yeşil kalır.
- **Paralel işler:**
  - `../bakimx-818` (#818, tek Plate bileşeni): `surface.tsx` / `DashPlate`'e
    dokunuyor.
  - #822 (araç kabul yöntem ekranı) `NEW_INTAKE_HREF` çevresinde.
  - Çakışmayı küçük tutmak için `surface.module.css`'teki `.hero*` sınıfları
    silinmez; yalnız kullanımdan kalkar. Temizliği sonraki dilimde yapılır.

## Yaklaşımlar

1. **Ortak `PageHeader` + rota kaydı (SEÇİLDİ).**
   - Bölüm, başlık ve standart düğmeler tek kayıtta tutulur.
   - Sayfa yalnız kendine özgü eklemeleri verir: alt satır, ek düğme.
   - Yükleme ekranı başlığı aynı kayıttan çizer, geçişte başlık kaybolmaz.
   - Bedeli: başlık ve düğme tanımı sayfanın yanında değil, merkezi dosyada durur.
2. **Her sayfa ortak bileşenle kendi başlığını çizer.**
   - Daha basit.
   - Ama yükleme ekranı hedef sayfayı bilmez, geçişte başlık yine kaybolur.
     Önlemek için her rotaya ayrı `loading.tsx` gerekir (yaklaşık 80 kopya).
   - İsteğin özünü çözmüyor.
3. **Next.js 16 Cache Components (PPR).**
   - Sayfanın sabit kabuğu önceden hazırlanır, veri akar. Uzun vadede en hızlı yol.
   - Uygulama genelinde bayrak gerektirir. Oturum okuyan layout ve tüm sayfaların
     `Suspense` ile yeniden yapılandırılması gerekir.
   - Bu istek için risk büyük.

Kullanıcı 1'i seçti (24-11).

## Kullanıcının verdiği kararlar

- **Breadcrumb her sayfada (A seçeneği):**
  - Üst seviyede `Bölüm › Sayfa`, alt sayfalarda tam yol.
  - Amaç: her sayfada aynı satır yapısı, başlık ve düğmeler hep aynı pikselde.
- **Yaklaşım:** 1 (ortak `PageHeader` + rota kaydı).
- **`/orders` limitsiz sorgusu:** ayrı iş olarak ele alınır.

## Tasarımcının kararları (kullanıcı onayladı, 24-11)

1. **Genel Bakış'ın başlığı:** bugün atölye adı; `Genel Bakış` olur. Atölye adı,
   tarih ve karşılama alt satıra iner.
2. **Telefonda dizilim:** breadcrumb → başlık → birincil düğme (tam genişlik)
   → ikincil düğmeler → alt satır. Alt satır düğmenin altına iner, böylece
   düğme her sayfada aynı yerde kalır.
3. **Başlık düğmeleri yalnız kayıttan gelir.** Sabit ikincil bağlantılar
   ("Bakiye Özeti", "Yaşlandırma") başlığa çıkar. Duruma bağlı olanlar
   ("Yeni Parça/İşçilik", devre dışı "Plaka Tara") içerikte kalır.
4. **İstemcide süzülen sayılar yerinde kalır** (Hatırlatmalar, Stok,
   Tedarikçiler). Yalnız sunucu sayıları alt satıra çıkar.
5. **Paket kilidi ekranında da başlık çizilir**, kapılı düğme gizlenir.
6. **Telefon üst barı** kayıtlı sayfalarda başlık yerine ortada logo gösterir.
   `pageActions` "+" ikonları kalkar.
7. **Ortak çerçeve** en fazla 1440px ve ortalı. Dar içerikli sayfalarda da
   başlık çerçeve genişliğinde.

## Tasarım

### Rota kaydı

- **Tek kaynak:** sol menünün bugünkü tanımı (`NAV_GROUPS`, `app-shell.tsx`
  içinde) paylaşılan bir modüle taşınır. Hem sidebar hem `PageHeader` aynı
  kaydı okur.
- **Kayıt öğesinin alanları:**
  - `href`, `label` (başlık), `group` (bölüm adı: breadcrumb'ın ilk halkası).
  - Varsa üst öğe (`/cashbox/payments` → Kasa).
  - **Standart düğmeler:** etiket, `href`, ikon, birincil/ikincil, paket
    kapısı (`feature`), yetki kapısı (`permission`).
- **Yol eşleşmesi:** tam yol eşleşmesiyle yapılır. Kayıtta olmayan yollar
  (alt sayfalar) bu dilimde çerçeve çizmez, bugünkü davranışlarını sürdürür.

### `PageHeader`

İstemci bileşeni; `usePathname` ile kayıttan çözülür. Ekranda sırasıyla şunlar
durur:

```
 Servis › Araç Kabulleri                           ← breadcrumb (13px, gri; bölüm düz metin, son halka aria-current)
 Araç Kabulleri                 [+ Yeni Araç Kabul] ← başlık (hero ölçeği) + standart düğmeler, başlık satırına hizalı
 23 kayıt                                           ← alt satır (isteğe bağlı)
 ──────────────────────────────────────────────
 sayfa içeriği (ortak çerçeve, sabit boşluk)
```

- **Breadcrumb bileşeni:** shadcn `breadcrumb` eklenir (`npx shadcn add
  breadcrumb`, radix-nova). Bölüm adları (Servis, Depo & Finans…) sayfa
  değildir, bağlantı olmaz.
- **Başlık:**
  - Ölçüsü bugünkü hero ile aynı: `.heroTitle`, 30px telefonda, 36px ≥640px, 700.
  - Başlık metni **her zaman kayıttan** gelir. Veriyle değişmez, böylece
    yükleme ekranıyla gerçek sayfa arasında metin sıçraması olmaz.
- **Standart düğmeler:**
  - Kayıttan gelir; görünürlüğü `enabledFeatures` ve `userIdentity` ile süzülür.
    İkisi de `AppShellChrome`'da zaten var, context ile verilir.
  - `userIdentity` bugün `teamPermissions` taşımıyor. Layout'tan eklenir, özel
    ekip yetkileri istemci kapısında da hesaba katılır.
  - Birincil düğme bugünkü hero CTA ölçüsünü korur.
  - Sayfa başlığa düğme ekleyemez (bkz. "Sayfanın verdiği eklemeler").
- **Telefonda dizilim (<640px):**
  - Breadcrumb → başlık → düğme satırı → alt satır.
  - Birincil düğme bugünkü gibi tam genişlik.
  - Alt satır düğmenin altına iner, böylece alt satırı olan ve olmayan
    sayfalarda düğme aynı yerde kalır.
- **Masaüstünde dizilim (≥640px):**
  - Breadcrumb → [başlık … düğmeler] → alt satır.
  - Düğmeler `align-items: center` ile başlık satırına hizalanır, `flex-end` değil.
- **Alt satırın yeri:** kayıtta "bu sayfanın alt satırı var" bilgisi tutulur.
  Yükleme ekranı bu satırın yüksekliğini boş olarak ayırır; veri gelince satır
  dolar, hiçbir şey kaymaz.

### Sayfanın verdiği eklemeler

- Sayfalar `<AppShell>`'i zaten kullanıyor. `AppShell`, kayıtlı yollarda
  `PageHeader`'ı kendisi çizer.
- Sayfa **yalnız `subtitle`** verir (ör. "23 kayıt", Genel Bakış'ta atölye +
  tarih + karşılama).
- Kayıtlı yollarda `pageTitle` gereksizleşir. Sekme başlığı zaten ayrı
  (`metadata`).
- **Başlık düğmeleri yalnız kayıttan gelir; sayfa başlığa düğme ekleyemez.**
  Yükleme ekranı yalnız kaydı bilir. Sayfanın sonradan eklediği bir düğme
  telefonda yeni bir satır açıp içeriği kaydırırdı (karşı-hedef). Bu yüzden:
  - **Hiç değişmeyen her düğme kayda girer:** birincil "Yeni …" düğmeleri ve
    ikincil sabit bağlantılar (Müşteriler → "Bakiye Özeti", Kasa → "Yaşlandırma").
  - **Duruma bağlı düğmeler sayfa içeriğinde kalır** (liste/sekme araç çubuğu).
    Ör. Stok'ta sekmeye göre değişen "Yeni Parça" / "Yeni İşçilik", Araçlar'daki
    devre dışı "Plaka Tara (yakında)" taslağı.
  - **Telefonda:** birincil düğme her zaman ilk düğme satırıdır (tam genişlik),
    ikincil düğmeler altındaki ikinci satırdadır. Satırlar kayıttan bilindiği
    için yükleme ekranı da aynı satırları çizer, birincil düğme her sayfada
    aynı yerde kalır.
- **Sayılar:**
  - Sunucuda hesaplanan sayılar (ör. `/orders`, `/customers`, `/quotes`) alt
    satıra taşınır.
  - İstemcide süzülen listelerin sayısı **yerinde kalır**: `/reminders`
    "Hatırlatmalar (n)", Stok ve Tedarikçiler'in liste içi sayıları. Süzgeçle
    değişen bir sayıyı başlığa taşımak için yeni bir istemci→başlık kanalı
    kurulmaz. Bu sayfaların kaydında alt satır yoktur.
- **Paket kilidi ekranı (`FeaturePaywall`):** kapsamdaki sayfaların çoğu, paket
  yoksa yükseltme ekranını `AppShell` içinden gösterir. Bu ekranda da başlık
  çizilir: breadcrumb + kayıttaki başlık, kapılı düğme gizli. Aksi hâlde
  yükleme anında görünen başlık sayfa gelince kaybolurdu.

### İçerik çerçevesi

- Kayıtlı sayfalarda `AppShell` içeriği tek bir çerçeveye koyar:
  - Genişlik `surface.root`'taki gibi en fazla 1440px, ortalı.
  - Başlık ile içerik arasında sabit boşluk.
- `wide` / `constrained` sayfalar (`/purchases`, `/bakimx-orders`) başlığı yine
  çerçeve genişliğinde çizer. İçerikleri çerçevenin içinde dar kalabilir; başlık
  satırı ve düğmeler her sayfada aynı sağ kenardadır.
- Genel Bakış'ın kendi `surface.root` sarmalı içerikte kalır, ama 1440 sınırı
  artık çerçevenin. İki kez uygulanmamalı.

### Yükleme ekranı

- `PageLoading` artık `PageHeader` (yalnız kayıttan: breadcrumb + başlık +
  standart düğmeler + boş alt satır yeri) + altında içerik spinner'ı çizer.
- Mevcut `loading.tsx` dosyaları değişmeden `PageLoading`'i kullanmaya devam
  eder. Yükleme ekranı kayıtlı olmayan bir yoldaysa bugünkü gibi yalnız spinner
  çizer.
- `cashbox/loading.tsx` yok. `/cashbox` ↔ `/cashbox/payments` ↔
  `/cashbox/aging` geçişlerinde de başlık anında görünsün diye eklenir.
- **Doğrulanacak varsayım:** yükleme ekranı görünürken `usePathname()` yeni yolu
  döndürür. Next 16'da prefetch edilmiş yükleme durumu gezinmeyi commit ettiği
  için böyle olmalı. Uygulamanın ilk adımı bunu tarayıcıda doğrular. Tutmazsa
  hedef yol, tıklanan bağlantıdan (`useLinkStatus` ya da kayıtlı `Link`
  sarmalı) alınır.

### Kabuk temizliği

- **Kalkanlar:**
  - Kayıtlı yollar için `CONTENT_H1_PATHS`, `OWN_TITLE_MENU_PATHS`,
    `MOBILE_CONTENT_HEADING_PATHS` istisnaları ve `AppShell`'in masaüstü
    `desktopTitle` h1'i.
  - Kayıtlı sayfaların `pageActions` mobil bar ikonları. Düğme artık çerçevede.
- **Telefon üst barı:** kayıtlı yollarda ortada logo (bugün Genel Bakış'taki
  gibi), başlık yazmaz. Çift başlık olmaz.
- **İçeriğe gömülü başlıklar:** sayfaların içeriğinde kendi çizdikleri
  başlık/sayı/"Yeni …" satırları kaldırılır; sayı alt satıra, düğme kayda taşınır.
  İstemci liste bileşenlerindeki düğmeler (`parts-list`, `suppliers-list`,
  `reminder-list`) için kural:
  - Düğme sabitse kayda taşınır.
  - Duruma bağlıysa sayfa içinde kalır. Ör. Stok'ta sekmeye göre "Yeni Parça" /
    "Yeni İşçilik" değişiyorsa düğme o sekmenin araç çubuğunda kalır.

### Genel Bakış'a özel

- Başlık bugün atölye adı. Kayıttan geldiği için `Genel Bakış` olur.
- Atölye adı, tarih ve karşılama alt satıra iner:
  `Usta Oto · Salı, 24 Kasım · Hoş geldiniz, Ali`.
- `data-tour="welcome-banner"` ve `data-tour="welcome-cta"` ürün turu çapaları
  yeni öğelerde korunur.

## Test ve doğrulama

- **Birim testleri:**
  - Kapsamdaki her menü sayfasının kayıt öğesi var.
  - Breadcrumb zinciri doğru (`/cashbox/payments` → 3 halka).
  - Kapılı düğmeler, paket veya yetki yokken listelenmiyor.
- **Kaynak kapısı** (`ui-contract.test.ts`'e): kayıtlı sayfalar `surface.hero` /
  kendi `<h1>`'lerini çizmez. Kalıp geri sızmasın.
- **Tarayıcı QA** (390 ve 1440):
  - `/dashboard` ↔ `/orders` ↔ `/customers` geçişlerinde breadcrumb, başlık ve
    birincil düğmenin `getBoundingClientRect()`'i aynı.
  - Yavaşlatılmış ağda geçiş sırasında başlık görünür, yalnız içerik spinner'da.
  - Telefonda çift başlık yok.
  - Lite paket ve teknisyen olmayan kısıtlı rol ile kapılı düğme görünmüyor.
- **Dört kapı:** `bun test`, `bun run lint`, `bun run typecheck`,
  `bun run build`.

## Kurucuya kalanlar

- Kayıt modülünün adı ve yeri, tip adları.
- `PageHeader`'ın `AppShell` içinde mi, ayrı bir sarmalda mı çizileceği.
  Koşul: kayıtlı sayfalar tek yoldan çizsin.
- Hangi düğmenin hangi yetki anahtarına bağlanacağı. Mevcut sunucu kapılarıyla
  aynı izin adı kullanılır.
- Yükleme-anı varsayımı tutmazsa alternatif yolun ayrıntısı.

## Takip (ayrı issue'lar)

- Alt sayfalar: detay / yeni / düzenle, raporlar alt sayfaları, bakiye,
  billing. Kayıt adlı breadcrumb (`Araç Kabulleri › 34 ABC 123`) ve İş Emri
  `DetailHeader`'ının çerçeveye taşınması.
- Ayarlar breadcrumb'ı.
- `/orders` sayfalama / "daha fazla göster".
- `.hero*` CSS temizliği (çakışan paralel işler kapandıktan sonra).
- Next.js 16 Cache Components değerlendirmesi.
