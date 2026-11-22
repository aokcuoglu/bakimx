# Ana sayfa: e-santral.com/bakimx birebir + pazarlama UI kiti — tasarım

- Tarih: 22 Kasım 2026
- Kapsam: **İş 1 / 3** — issue #781 (İş 2: #782, İş 3: #783)
- Durum: sahip onayladı (22-11-2026)
- Kaynak: https://e-santral.com/bakimx/ — `index.html`, `style.css?v=12`, `js/app.js?v=5`
  (22-11-2026'da indirildi; başvuru kopyası `docs/design/esantral-reference/` altına
  commit'lenir, canlı sayfa değişirse bu sürüm esas alınır)

## 1. Niyet ve neden

Sahip, BakımX'in pazarlama ana sayfasının (`/`) e-santral.com/bakimx'in **birebir**
aynısı olmasını istiyor: yapı, metinler, görseller, ölçüler. Uygulama içi tasarım
22-11'de aynı kaynağa geçti (`docs/design-pattern-esantral.md`, PR #773/#775); ana
sayfa bu dili taşıyan ilk pazarlama yüzeyi olacak.

Ticari strateji (sahip kararı, 22-11): **"Önce kullanıcıları uygulamanın içine
çekelim."** Tek düşük giriş fiyatı — *Tek paket, her zaman. ₺1.499/ay, KDV dahil* —
ile edinim. Sahibin netleştirmesi (22-11): *"Şu anki durumda tek paket ile ilerlemek
istiyorum. Ekstra maliyetli kısımları uygulama içerisinde kullanıcılara satabiliriz."*
Yani dış maliyeti olan yetenekler (ör. şaseden parça getirme) pakete dahil değil,
**uygulama içi satın alma**. Bu yüzden kaynaktaki "ek modül yok / bütün özellikler
dahil" vaatleri §6.1'deki gibi revize edilir.

Aynı işte sayfadan bir **UI kiti** çıkarılır (renkler, buton ölçüleri, köşeler,
tipografi, form, modal) — sonraki pazarlama sayfaları ve kayıt modalı bunu kullanır.

## 2. Üç işlik sıra (sahip onayladı)

1. **Bu belge:** ana sayfa birebir + UI kiti. Ödeme/abonelik koduna dokunmaz.
2. **Faturalamada tek paket:** `plans-catalog`, kayıttaki paket seçimi, `/fiyatlar`,
   `/checkout`, TAMI tutarı, özellik kilitleri, abonelik ayarları, mevcut abonelerin
   geçişi. Açık kararlar §11'de; o işin kendi tasarımında sorulur.
3. **Kısa kayıt modalı:** e-santral'ın 5 alanlı "Ücretsiz deneyin" penceresi; 2'nin
   üstüne kurulur.

Üçü de `dev`'e gider, prod'a **aynı sürümde birlikte** çıkar (ana sayfa ₺1.499 derken
ödeme sayfasının 3 paket gösterdiği an canlıda yaşanmaz). Bu iş `main`'e/prod'a
kendi başına çıkmaz.

## 3. Hedefler, hedef olmayanlar, anti-hedefler

**Hedefler**
- `/` sayfası 1440px ve 390px genişlikte e-santral ile yan yana konduğunda, §8'deki
  bilinçli sapmalar dışında ayırt edilemez.
- UI kiti: tek yerde tanımlı token'lar + yeniden kullanılabilir bileşenler +
  `/design` vitrininde bir bölüm + `docs/design-pattern-esantral.md`'ye pazarlama
  ölçeği bölümü.
- "Sizi arayalım" modalı gerçekten çalışır: talep mevcut `DemoRequest` kaydına düşer.

**Hedef olmayanlar**
- `/fiyatlar`, `/register`, `/checkout`, `plans-catalog` → İş 2.
- 5 alanlı kayıt modalı → İş 3 (bu işte "Ücretsiz deneyin" `/register`'a gider).
- Diğer 19 public sayfanın (blog, fiyatlar, rehber…) ortak `Header`/`Footer`'ı —
  dokunulmaz; yeni üst/alt bant yalnız `/`'da.
- Uygulama içi ekranlar.

**Anti-hedefler (çalışsa bile başarısızlık sayılır)**
- LCP gerilemesi: hero başlığı hidrasyona bağlı görünür hâle gelirse
  (`docs/landing-performance.md`, BAK-165).
- Veri göndermeyen sahte form (e-santral'daki gibi) — bizde her form ya gerçek bir
  uca bağlıdır ya da gerçek bir sayfaya gider.
- KVKK/gizlilik bağlantılarının siteden kaybolması.
- Paylaşılan `Button`/`Input`/`Dialog` varsayılanlarının global değişmesi.

## 4. Kısıtlar (repo kuralları)

- Ham `<button>/<input>/<details>` yok → shadcn/Radix: `Button` (`asChild` ile
  `Link`), `Dialog`, `Accordion` (`type="single" collapsible`, `AccordionItem value`),
  `Input`, `Checkbox`, `Form`.
- Formlar: react-hook-form + zod + shadcn `Form`; şema `src/lib/validations/`.
- Sabit renk sınıfı yok; renkler token. Kontrast WCAG AA (`theme-tokens.test.ts`).
- Landing'de `framer-motion` yok; giriş/kaydırma animasyonu saf CSS veya
  `components/shared/reveal.tsx`.
- Next 16: kod yazmadan önce `node_modules/next/dist/docs/` ilgili kılavuz
  (Image, metadata).
- Statik pazarlama görselleri `public/landing/**` altında (middleware muaf).
- Kalite kapısı: `bun test` → `bun run lint` → `bun run typecheck` → `bun run build`.

## 5. Yaklaşımlar

**Formlar (sahibe sunuldu):**
- A) İki modal da birebir ve gerçek (5 alanlı kayıt dahil) — dönüşüm için en iyisi,
  ama kayıt akışını ve güvenlik sınırını değiştirir; paket seçimi hâlâ varken anlamsız.
- B) Görünüm birebir, modal yok; düğmeler `/register` ve `/demo`'ya gider — en az risk,
  e-santral deneyimi kaybolur.
- **C) Karma — seçildi.** "Sizi arayalım" birebir ve gerçek; "Ücretsiz deneyin" şimdilik
  `/register`. Kısa kayıt modalı İş 3 (paket seçimi kalkınca kayıt zaten sadeleşir).

**Stil uygulaması (benim kararım):**
- Kaynak CSS'i olduğu gibi global CSS olarak almak — en hızlı, ama sabit renkler ve ham
  HTML elemanları repo kapılarını kırar. Elendi.
- Her şeyi Tailwind utility sınıflarına çevirmek — `clamp()`/`svh` ağırlıklı ölçüleri
  okunmaz uzun sınıf dizilerine döker, kaynakla satır satır karşılaştırma zorlaşır.
- **Seçilen:** değerler `globals.css`'te token; kit ve sayfa **CSS modülleri** bu
  token'lara `var()` ile bağlanır; etkileşimli öğeler shadcn/Radix bileşenleri.
  Mevcut emsaller: `landing-editorial.module.css`, `dashboard/surface.module.css`.

## 6. Sayfa — bölüm bölüm

Ölçüler kaynak `style.css`'ten birebir alınır; burada yalnız iskelet ve davranış var.
Gövde: beyaz zemin, 17px (telefonda 16px) / 1.5, `letter-spacing: -0.01em`, sistem
yazı yığını (mevcut `--font-sans`; Google Fonts/Inter yüklenmez — 22-11 kararı).

| # | Bölüm | Çapa | İçerik ve davranış |
|---|---|---|---|
| 1 | Üst bant | — | Yapışkan, 68px (≤640: 58px), buzlu beyaz. Solda "Bakım"+X wordmark (→ `#hero`), ortada Nasıl çalışır / Özellikler / Fiyat / Sorular (≤960 gizli), sağda **Giriş yap → `/login`** (≤640 gizli) + mavi hap **Ücretsiz deneyin → `/register`**. Mobil menü yok (kaynakta yok). |
| 2 | Hero | `#hero` | `#e7e9ed` gri kutu, pencere yüksekliğine oturur. H1 "Oto servisinizi / telefonunuzdan yönetin.", alt metin, **Ücretsiz deneyin → `/register`** + **Sizi arayalım › → arama modalı**. Altta ustanın elinde telefon fotoğrafı; ekran deliğinde canlı HTML uygulama maketi (Yıldız Oto Servis, KPI'lar, 4 iş emri satırı, 3 bildirim, alt sekme çubuğu). |
| 3 | Dükkânda bir gün | `#nasil` | "BakımX ile dükkanınızda bir gün." + önceki/sonraki ok düğmeleri (≤640 gizli). Yatay kaydırmalı, snap'li 4 fotoğraf kartı (380px, 4:5, 24px köşe, alt degrade, sol üstte hap etiket, altta beyaz açıklama). |
| 4 | Diğer özellikler | `#ozellikler` | "BakımX diğer özellikleri" + 6 gri kutu (3/2/1 kolon), mavi çizgi ikon + başlık + gri açıklama. Kaydırınca belirir. |
| 5 | Geçiş | `#gecis` | Gri büyük kutu: "Eski sistemden sizi biz taşıyoruz. *Excel'inizden bile.*" + açıklama + **Sizi arayalım (büyük) → arama modalı** + **Ücretsiz deneyin › → `/register`**; sağda numaralı 3 adım. |
| 6 | Fiyat | `#fiyat` | "Tek paket, her zaman." + alt metin + **₺1.499 / ay, KDV dahil** + 6 dahil madde (mavi tikli) + **Ücretsiz deneyin → `/register`** + "Kart bilgisi istenmez." |
| 7 | SSS | `#sorular` | 5 soru (kaynaktaki metinler), yalnız alt çizgili akordeon, dönen chevron. |
| 8 | Son çağrı | — | "BakımX'i ücretsiz deneyin." + **Ücretsiz deneyin** + **WhatsApp'tan sorun ›** (gerçek destek WhatsApp bağlantısı; kaynakta `#sorular` yer tutucusu). |
| 9 | Alt bant | — | `#f5f5f7`, 13px gri: küçük wordmark, aynı 4 çapa + Giriş yap, "© 2026 BakımX" + **§8.3 yasal bağlantılar**. |

**Metinler:** §6.1'deki üç revizyon dışında kaynaktaki gibi, kelimesi kelimesine (bkz.
başvuru kopyası). Sayfadaki tüm metinler **tek bir içerik dosyasında** toplanır (ör.
`src/components/marketing/landing/content.ts`) — İş 2 fiyat/kapsam metnini tek yerden
düzeltir; `page.test.ts` ve JSON-LD de bu dosyadan okur. SEO açıklaması kaynaktaki:
"Oto servisinizi telefonunuzdan yönetin. İş emri, parça, stok, kasa ve randevu tek
yerde. Tek paket, her zaman ₺1.499."

### 6.1 Metin revizyonları (sahip: "eski yazılanları revize edersin")

Kaynak "hiç ek ücret yok" diyor; karar "ek maliyetli kısımlar uygulama içinde satılır".
Önerilen metinler (sahip PR'da değiştirebilir):

| Yer | Kaynak | Yeni |
|---|---|---|
| Fiyat alt metni | Tüm özellikler dahil. Ek modül, gizli ücret, kademeli paket yok. | Servisinizin günlük işi için gereken her şey dahil. Kademeli paket, gizli ücret yok. |
| Dahil listesi, 2. madde | Ruhsat okuma ve parça sorgulama | Ruhsat okuma ile hızlı araç kabul |
| SSS "Fiyata neler dahil?" | Tek paket var: sitedeki bütün özellikler aylık ₺1.499'a (KDV dahil) dahildir. Ek modül ya da gizli ücret yoktur. | Tek paket var: servisinizi yönetmek için gereken her şey aylık ₺1.499'a (KDV dahil) dahildir. Şaseden parça sorgulama gibi ek maliyetli hizmetleri isterseniz uygulama içinden ayrıca alabilirsiniz. |

"Dükkânda bir gün" şeridindeki **Parça Sorgulama** kartı aynen kalır — yetenek
üründe var (OEM araması `src/lib/tecdoc/`), yalnız pakete değil uygulama içi satışa
bağlı; fiyat bölümü ve SSS bunu dürüstçe söylüyor. Hangi yeteneklerin ek ücretli
olduğu ve fiyatları İş 2'nin kararıdır; bu metinler o zaman yeniden gözden geçirilir.

**Hero ölçekleme:** kaynaktaki iki ölçüm (metin bloğu yüksekliği → `--text`, ekran
deliği genişliği / 350 → `--s`) küçük bir istemci adası yapar; H1, alt metin ve
düğmeler **sunucuda render edilir ve asla gizli başlamaz**. JS gelmeden önce CSS
varsayılanları (`--text: 380px`, `--s: .7`) kabul edilebilir bir görünüm verir.

**Maket:** dekoratif bir ürün görseli olarak ele alınır — kapsayıcıda `role="img"` +
açıklayıcı `aria-label`, içi ekran okuyucudan gizli. Veriler sentetik (gerçek müşteri
verisi yok).

**Görseller:** `https://e-santral.com/bakimx/img/` altındaki `eller-telefon.webp`,
`kabul(-800).webp`, `parca(-800).webp`, `teslim(-800).webp`, `usta.webp`,
`bakimx-x.svg`, `bakimx-icon.svg` → `public/landing/esantral/`. Kullanım hakkı sahip
tarafından varsayıldı (BakımX için üretilmiş). Hero fotoğrafı LCP adayıdır; `next/image`
ile öncelikli yüklenir.

## 7. "Sizi arayalım" modalı

- Radix `Dialog`; kaynak görünümü: 460px, 30px köşe, büyük gölge, bulanık arka plan,
  `translateY(18px) scale(.98)` → 0 / 320ms giriş; ≤640'ta alttan açılan sheet
  (26px üst köşeler). Kapat: 32px gri daire.
- İçerik: 44px BakımX ikonu, "Sizi arayalım", gri alt metin; **Ad soyad** ve
  **Cep telefonu** yüzen etiketli alanlar; onay kutusu "Bu numaradan aranmayı ve KVKK
  aydınlatma metnini kabul ediyorum" (bağlantı → `/kvkk`); **Beni arayın**.
- Doğrulama (kaynaktaki kurallar, zod şeması `src/lib/validations/`): ad en az iki
  kelime; telefon `5xxxxxxxxx` (yazarken `05xx xxx xx xx` biçimlenir, `+90`/baştaki `0`
  toleranslı); onay zorunlu. Hata: alan kırmızı çerçeve + üstte tek satır kırmızı mesaj.
- Gönderim: mevcut `POST /api/demo-request`. **Sunucu şeması gevşer:**
  `businessName`, `city`, `monthlyVehicles` isteğe bağlı olur (gönderilmezse boş dize
  saklanır — kolonlar `String`, **migration yok**). `notes` alanına kaynak işareti
  yazılır ("Ana sayfa · Sizi arayalım"). `/demo` sayfasının formu kendi istemci
  zorunluluklarını korur. Mevcut hız sınırı/kötüye kullanım korumaları aynen geçerli.
- Başarı durumu: 64px yeşil daire içinde tik, "Teşekkürler.", "Arama talebiniz alındı.
  En kısa sürede sizi arayacağız.", **Tamam**. Sunucu hatası: aynı kırmızı mesaj satırı.
- Erişilebilirlik: odak modal içinde kalır, Escape kapatır, kapanınca odak açan düğmeye
  döner, ilk alana otomatik odak.

## 8. Birebirden bilinçli sapmalar (benim kararlarım — sahip itiraz edebilir)

1. **Gerçek hedefler:** "Giriş yap" → `/login` (kaynakta `#fiyat`); "WhatsApp'tan
   sorun" → gerçek WhatsApp destek bağlantısı; KVKK/koşullar bağlantıları → `/kvkk`,
   `/terms`; "Ücretsiz deneyin" → `/register` (İş 3'e kadar).
2. **Kontrast:** hero alt metni kaynakta `#6e6e73` / `#e7e9ed` = **4.17:1** (AA altı,
   metin 16–23px/500). Göze fark edilmeyecek kadar koyu bir gri ton (≥4.5:1) kullanılır.
   Diğer kaynak çiftleri ölçüldü ve geçiyor (gri/beyaz 5.07, beyaz/mavi 4.70,
   bağlantı/beyaz 5.57, durum hapları 4.78–4.87).
3. **Alt bant yasal bağlantılar:** KVKK aydınlatma metni, Gizlilik, Kullanım koşulları
   aynı küçük gri stilde eklenir (Türkiye'de zorunlu bilgilendirme; kaynakta yok).
4. **Wordmark:** "Bakım" yazısı + X logosu kaynaktaki gibi kullanılır. Marka
   notlarındaki "yalnız logo, yazı yok" kuralı bu sayfa için sahibin birebir kararıyla
   aşılır.
5. **Ölçüm betiği:** kaynaktaki `/m/olcum.js` alınmaz; BakımX'in kendi
   `trackMarketingEvent` olayları kullanılır (§9).
6. **İndekslenebilirlik:** kaynak `noindex`; bizim sayfa indekslenir, mevcut SEO
   altyapısı (metadata, JSON-LD, sitemap) korunur.
7. **Site asistanı balonu kalır** (`SiteAssistant`, kök layout'ta `/` için açık).
   Kaynakta yok; çalışan bir destek kanalını sessizce kaldırmamak için korunur. Hero
   düğmeleriyle ve mobil arama sheet'iyle çakışmadığı tarayıcıda doğrulanır (sheet
   açıkken modal katmanı balonun üstünde olmalı).
8. **Fiyat/kapsam metinleri** §6.1'deki gibi revize edilir.
9. **Çerez onay bandı kalır** — §9'daki olaylar onay olmadan gönderilmez.

## 9. Ölçüm ve SEO

- Olaylar mevcut adlarla, konum etiketli: `trial_cta_click` (`header`, `hero_primary`,
  `move_secondary`, `price`, `final`), `demo_cta_click` (`hero_secondary`,
  `move_primary`, `destination: "callback_modal"`), başarılı arama talebinde mevcut
  demo-talebi olayı (adı `src/lib/marketing-analytics.ts`'ten). Lite'a özgü olaylar
  (`lite_cta_click`) ana sayfadan kalkar — Lite İş 2'de kalkıyor.
- JSON-LD: `Organization` + yeni 5 SSS'den `FAQPage` + `SoftwareApplication` /
  `Offer` (1499 TRY, aylık).
- `LANDING_FAQ_ITEMS` kaynaktaki 5 soruyla değişir; tam SSS (`FAQ_ITEMS`) korunur.

## 10. UI kiti

**Token'lar** (`globals.css`, tek tanım; aynı değerde mevcut token varsa o kullanılır —
ör. `--primary #0071e3`, `--foreground #1d1d1f`, `--control-h 44px`,
`--control-h-lg 50px`):

| Rol | Değer |
|---|---|
| ikincil metin | `#6e6e73` (+ hero için AA tonu) |
| üçüncül metin | `#86868b` (yalnız maket/dekoratif) |
| yumuşak yüzey | `#f5f5f7` |
| hero zemini | `#e7e9ed` |
| çizgi | `#d2d2d7` |
| bağlantı | `#0066cc` |
| birincil hover | `#0077ed` |
| nötr düğme / hover | `#e8e8ed` / `#dcdce1` |
| odak halkası | `0 0 0 4px rgb(0 113 227 / .18)` |
| hata çerçeve / metin | `#e30000` / `#d70015` |
| başarı zemin / ikon | `#e6f5ea` / `#1b7a3d` |
| köşeler | input 12 · ok/foto kartı 24 · kutu 28 (≤640: 22) · büyük kutu 32 (≤640: 24) · modal 30 · hap 999 |
| tipografi | H1 `clamp(32px, min(5.4vw, 7svh), 76px)`/700/−0.045em · bölüm başlığı `clamp(32px, 3.4vw, 48px)`/700/−0.035em · kutu başlığı 22/700/−0.025em · gövde 17 · küçük 13 |

**Bileşenler** (`src/components/marketing/kit/`): `PillButton` (44 / büyük 50 /
üst bant 15px-600; `Button asChild` üstüne), `TextLink` ("… ›", hover alt çizgi),
`RoundIconButton` (44 / 32), `Wordmark`, `FeatureTile`, `PhotoCard` + kaydırmalı ray,
`NumberedSteps`, `CheckList`, `PriceBlock`, `FaqAccordion`, `FloatingField` (yüzen
etiketli, shadcn `Input` üstüne), `MarketingDialog` (masaüstü modal / mobil sheet),
`SuccessState`.

**Vitrin:** `/design` sayfasına "Pazarlama kiti (e-santral)" bölümü — token
örnekleri ve her bileşenin canlı hâli. **Belge:** `docs/design-pattern-esantral.md`'ye
"Pazarlama ölçeği" bölümü.

## 11. İş 2'ye devredilen açık kararlar (kayıt için; bu işte cevaplanmaz)

Karar verildi: tek paket ₺1.499/ay KDV dahil; ek maliyetli yetenekler uygulama içi
satın alma. İş 2'de cevaplanacaklar: hangi yetenekler ek ücretli (şaseden parça/TecDoc,
AI danışmanı, OCR?) ve nasıl fiyatlanır; mevcut abonelerin geçişi (Lite süresiz
kampanya, Profesyonel, Premium, eski Başlangıç ₺749); yıllık fiyat; deneme süresi
(bugün 7 gün); `/fiyatlar`, `llms.txt` ve diğer sayfalardaki 3 paket ifadelerinin
revizyonu ("eski yazılanlar"); §6.1 metinlerinin son hâli.

## 12. Test ve kabul

- **Birim/kaynak testleri:** `src/app/page.test.ts` yeni sayfaya göre yeniden yazılır
  — H1 sunucuda görünür ve gizli başlamaz, landing'de `framer-motion` yok, CTA'lar
  konum etiketli olay gönderir, "₺1.499" fiyat bölümünde. `faq-data.test.ts` 5 maddeye
  güncellenir. Arama formu şeması ve gevşetilmiş `demoRequestSchema` için testler.
- **E2E (yerel):** eski içeriği doğrulayan landing spec'leri (`landing-redesign`,
  `landing-product-stage`, `lite-acquisition`, `demo-marketing`, `public-site`,
  `button-design`, gerekirse `page-titles`) yeni sayfaya güncellenir; arama modalı
  gönderimi uçtan uca.
- **Görsel eşlik:** e-santral ve yerel sayfa 1440×900 ve 390×844'te bölüm bölüm ekran
  görüntüsüyle karşılaştırılır; fark yalnız §8 maddeleri olabilir.
- **Performans:** `docs/landing-performance.md` ölçüm betiğiyle LCP; hero başlığı ilk
  boyamada görünür.
- **Erişilebilirlik:** klavyeyle tüm CTA'lar, kart rayı (oklar + kaydırma), akordeon,
  modal (odak tuzağı, Escape, odak dönüşü); yatay taşma yok (390px).
- Dört kapı yeşil; lint sıfır hata.

## 13. Teslimat

GitHub issue'su açılır (İş 2 ve İş 3 için de birer takip issue'su), dal
`issue/<n>-esantral-landing`, izole worktree, kapılar → yerel `dev`'e promote
(localhost:3001'de QA) → onaydan sonra `dev`'e taslak PR (`ci` etiketsiz). `main`'e ve
prod'a çıkmaz (§2).

**Sürüm sonucu (benim kararım, flag yok):** iş `dev`'e normal merge edilir. Sürüm
`dev → main` PR'ının tamamı olduğu için (`docs/releasing.md`) İş 2 ve 3 bitene kadar
`dev`'den prod sürümü alınmaz — sahibin e-santral işleri için zaten "main'e çıkma"
kararı var. Acil düzeltme gerekirse `releasing.md` §Hotfix yolu (`main`'den dallan).
Flag reddedildi: eski landing'i yeni sayfanın yanında yaşatmak, eski bileşenlerin
silinmesini, test yeniden yazımını ve SSS değişimini ikiye katlardı.

## 14. Uygulayıcıya kalanlar

Bileşen dosya bölünmesi; CSS modülü adlandırması; ikonların kaynak SVG'den mi lucide
eşdeğerinden mi alınacağı (görünüm birebir kalmak şartıyla); hero ölçekleme adasının
tekniği (ResizeObserver vb.); sayfadan düşen eski bölüm bileşenlerinin (`HeroSection`,
`LandingContent`, `FAQSection`, `ProductStage`…) başka yerde kullanılmıyorsa ayrı bir
commit'te silinmesi.

Okuma sırasında tespit edilen, uygulayıcının çözeceği noktalar:
- Paylaşılan `Header` diğer sayfalardan `/#neden`, `/#sss` gibi çapalara bağlanıyor;
  yeni sayfada bu adlar karşılıksız kalır → takma çapa ya da `Header` bağlantı
  güncellemesi (yalnız href).
- `PublicSite` sarmalayıcısı `framer-motion` kullanıyor; yeni `/` landing kuralı gereği
  onu kullanmaz ya da hareketsiz bir varyantını kullanır.
- `demo_cta_click` olay tipine `"callback_modal"` hedefi eklenir.
- Destek WhatsApp bağlantısı: `src/lib/support-whatsapp.ts`.
