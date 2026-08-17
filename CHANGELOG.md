# Changelog

BakımX sürüm geçmişi. Her sürümün ayrıntılı notu [`docs/releases/`](./docs/releases/) altındadır. Sürümler [SemVer](https://semver.org/lang/tr/) ve dev→staging→main akışını izler (bkz. [docs/releasing.md](./docs/releasing.md)).

## Yayınlanmamış (Unreleased)
Henüz yok — v0.14.1 tag'lendi, sonraki sürüm için birikmiş tag'siz geliştirme bulunmuyor.

## 0.14.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.14.1 | Canlı destekte yeni mesaj yöneticiye e-posta ile bildiriliyor | [v0.14.1](./docs/releases/v0.14.1.md) |
| 0.14.0 | Canlı destek, servisler arası araç geçmişi, ruhsat/şase okuma, KDV modeli yeniden kuruldu | [v0.14.0](./docs/releases/v0.14.0.md) |

0.14.1 öne çıkanlar: v0.14.0 canlı destek masasını yayına almıştı ama **kimse yeni mesajdan haberdar olmuyordu** — yanıt verebilmek için birinin `/admin/live-chat` sekmesini açık tutması gerekiyordu, yani sayfadaki "genelde birkaç dakika içinde yanıtlıyoruz" sözünün fiilî karşılığı yoktu. Artık ziyaretçi yeni bir görüşme açtığında ya da yanıtsız bir bekleyiş başlattığında `ADMIN_EMAILS` adreslerine e-posta gidiyor (mesaj metni, iletişim bilgisi, hangi sayfadan yazdığı, gelen kutusuna buton; mesai dışı görüşmeler konu satırında ayrışıyor). Ziyaretçi düşüncesini üç satıra bölerse üç e-posta gitmiyor — karar saf ve test edilebilir bir fonksiyonda (`startsNewBurst`: yeni görüşme, temsilci yanıtı sonrası ilk mesaj, ya da 15 dk sessizlik). Gönderim best-effort, hiçbir koşulda ziyaretçinin mesajını düşürmüyor; `sendSystemEmail` yerine `sendEmailDirect` kullanılıyor çünkü o yol `workshopId` zorunlu isteyip destek trafiğini rastgele bir kiracının İletişim Kayıtları ekranına düşürürdü (#194 sızıntı sınıfı) — takas, iletişim kaydı tutulmaması. Ayrıca **tutamadığımız bir söz geri alındı:** çevrimdışı metni "size buradan **ve e-posta ile** dönüş yapalım" diyordu, sistem ziyaretçiye hiç e-posta göndermiyordu; varsayılan düzeltildi (**prod satırı DB'de, `/admin/live-chat/settings` üzerinden elle düzeltilmeli**). CI tarafında app-dev deploy'u `[deploy-dev]` işaretçisine bağlandı — Actions faturasının %73'ünü yiyen kalem, aylık ~4.560 dk → ~1.375 dk; ve branch protection kurulduğu için "hiçbir dal korumalı değil" diyen tüm dokümanlar gerçek duruma çekildi. **Migration YOK.**

0.14.0 öne çıkanlar: **aracın ve parçanın kimliğini elle yazma dönemi kapandı** — ruhsat artık iş emri sihirbazının her yolunda okutulabiliyor ve şase kamerayla taranıyor (girilen plaka/şase ruhsattan farklıysa **üzerine yazılmaz**, fark uyarı olarak gösterilir); bir plaka birden çok serviste kayıtlıysa geçmişi görünür hâle geldi — kişisel veri **varsayılan olarak maskeli**, maskeyi kaldıran şey ruhsatın o serviste okutulmuş olması (`VehicleHistoryGrant`), **fiyat hiçbir koşulda servisler arası çıkmaz** ve bu iki testle kapıya bağlı; dışarıdan alınan parçanın numarası TecDoc / BakımX / stok kataloglarında aranıp tek tıkla eşleştiriliyor (yalnız `tecdocArticleId` bağı kurulur — `partId` yazmak stok düşümü tetiklerdi). **Para tarafı:** KDV modeli baştan kuruldu — varsayılan KAPALI, girilen tutar her zaman net (₺100 giren ₺83,33 okumuyor artık), kalem tablosunun "Toplam" sütunu KDV dahil okunuyor ve müşteriye giden özet/PDF/WhatsApp çıktıları nihayet indirim + KDV kırılımını basıyor. **Parça talepleri** iptal/düzenleme kararı kazandı ve karara bağlanmamış talep varken araç teslim edilemiyor (eskiden teslim sonrası emir kilitlendiği için talep sonsuza kadar askıda kalıyordu); dış alım kaydı teknisyen ekranından silinebiliyor. Ayrıca **BakımX'in kendi canlı destek masası** devreye girdi (ziyaretçi widget'ı + çalışma saatleri + `/admin` gelen kutusu; ECS'te ortak pub/sub olmadığı için bilinçli olarak yoklama, SSE değil), `/register` 4 adımlı sihirbaza dönüştü ve landing Faz 1-3 (duyuru barı, itiraz kart şeridi, hero ask bar) yayına girdi. **Migration VAR** (4 migration: canlı destek tabloları, `includeVat` varsayılanı, `VehicleHistoryGrant`, parça talebi iptali).

> **0.13.0 neden yok:** `v0.13.0` tag'i hiçbir zaman `dev`'e ya da `main`'e girmemiş bir dala (`17083f3`) işaret ediyordu ve GitHub'da yanlışlıkla "Latest" görünüyordu; tag ile release silindi. Aynı tag adını farklı bir commit için yeniden kullanmak, tag'i daha önce fetch etmiş her klonda kalıcı karışıklık bırakacağı için numarada boşluk bırakıldı. v0.14.0 ayrıca v0.12.0'dan beri `main`'e tag'lenmeden girmiş içeriği de (PR #364 release partisi) devralır.

## 0.12.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.12.0 | Deneme/abonelik bitişi artık paywall: oturum kapanıyor, giriş `/checkout`'a düşüyor | [v0.12.0](./docs/releases/v0.12.0.md) |

Öne çıkanlar: **süresi bitmiş plan artık salt-okunur mod değil, gerçek bir paywall** — eskiden kullanıcı kırmızı bantla panelde dolaşmaya devam ediyordu ("Verileriniz görüntülenebilir"), artık oturumu kapatılıyor ve girişten sonra doğrudan `/checkout`'a düşüyor. Kapsam üç durum: `trial_expired` + `subscription_expired` + `subscription_inactive` (`isPlanExpiredLock`). Çıkış **middleware'de** yapılıyor çünkü bir Server Component cookie yazamaz; bu aynı zamanda RSC soft-navigation'ı da kapsar ve yeni bir `GET` çıkış yüzeyi açmaz. İki döngü koruması: cookie temizlenmezse `/login → /dashboard → /login` sonsuzlaşıyordu, ve `/checkout`'un bekleyen siparişte `/billing`'e (yani `(app)` grubuna) yönlendirmesi kilitli iş yerinde döngü demekti — kilitliyse bekleyen sipariş satır içi gösteriliyor. Kurucu **impersonation muaf** (yoksa admin'in kendi oturumu düşer). Sunucu tarafı yazma kilidi (`assertWriteAccess`) aynen duruyor. Düzeltme: iş emri/teklif/randevu listelerindeki "Düzenle" aksiyonu gerçekten düzenlemeyi açıyor. Ops: `bun run db:prod-reset` ile kiracı verisi sıfırlama script'i geldi — global katalogları korur, `--confirm` kapılı, DB URL'ini dosyadan okur ve hiçbir otomatik akıştan çağrılmaz. **Migration YOK.**

## 0.11.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.11.0 | Teknisyen iş takibi, fiyatsız kalemle teslim engeli, katalog parça kimliği kilidi | [v0.11.0](./docs/releases/v0.11.0.md) |

Öne çıkanlar: **teknisyen ile ofis arasındaki döngü kapandı** — kontrol listesi teknisyene atama anında sistem şablonundan otomatik üretiliyor ve zorunlu maddeler işe başlama + tamamlama kapılarına bağlandı; iş emrindeki her parça/işçilik kalemi "yapıldı" olarak işaretlenebiliyor (`ServiceOrderItem`'da tek gerçek kaynak); parça talebi artık araca-uygun TecDoc katalogundan seçiliyor ve ofisteki yeni **Parça Talepleri paneli** talebi tek tıkla kaleme çeviriyor (`convertedAt` ile kalıcı gate). **Para bütünlüğü:** fiyatı hiç girilmemiş kalem varken araç teslim edilemiyor artık — teslimden sonra iş emri kilitlendiği için o tutar kalıcı eksik kalıyordu; **0 TL geçerli fiyattır** ve engellemez. Katalogdan seçilen parçanın ad/kod/marka/kategori bilgisi kilitlendi. Güvenlik: `parts_request_converted` olayı genel paylaşım ve pasaporttan gizlendi. Arayüz: toast'lar mobil alt navigasyonun üstüne alındı (46px örtüşme). Geliştirici tarafında SSM tüneli artık kendini onarıyor (keepalive + süpervizör; düşen tünel uygulama hatası gibi görünüyordu). **Migration VAR** (iki migration, 8 kolon + 2 indeks + 1 FK).

## 0.10.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.10.0 | Katalog seed pipeline'ı onarıldı, parça detayı modalı, Contabo emekliliği, büyük temizlik | [v0.10.0](./docs/releases/v0.10.0.md) |

Öne çıkanlar: her deploy'da koşan **araç kataloğu seed adımı, eklendiği 2026-07-24'ten beri hem prod hem dev'de sessizce başarısızdı** (non-blocking olduğu için yalnız bir uyarı satırı bırakıyordu). Üst üste üç kusur çıktı ve her biri bir öncekini çözünce göründü: RDS TLS doğrulaması (`self-signed certificate in certificate chain`, P1011) → fixture'ların tamamının belleğe alınması → 512 MB'lık one-off task'ın OOM ile öldürülmesi (exit 137). Katalog prod'a elle yüklendiği için kullanıcıya yansımıyordu; bozuk olan **kendi kendini iyileştirme**ydi. Yeni özellik: iş emri parça satırında **Parça Detayı modalı** (teknik özellikler, OEM/EAN, "bu araca uygun" rozeti, muadiller — parça başına tek faturalı çağrı). **Contabo dönemi kapandı** (VPS workflow'u, compose'u ve script'leri kaldırıldı; rollback artık ECS task-def geri alımı) ve dokümanlar `docs/` altında toplandı. Büyük temizlik: erişilemeyen bileşenler, **6 ulaşılamaz API rotası** (auth'lu ama ölü saldırı yüzeyi, dördü mutasyon yapıyordu), emekli PaddleOCR sidecar'ı, hiç devreye alınmamış `@react-pdf/renderer` hattı (paket düştü) ve `src/components/app` yığınının domainlere bölünmesi. Net −3378 satır. Migration yok.

## 0.9.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.9.1 | Parça araması marka ve kategori adını da kapsıyor | [v0.9.1](./docs/releases/v0.9.1.md) |
| 0.9.0 | Parça veri boru hattı onarımı, prefetch tetikleme, deterministik Docker build | [v0.9.0](./docs/releases/v0.9.0.md) |

0.9.0 öne çıkanlar: katalog parçaları **veritabanına yazılamıyordu** (5 sn transaction sınırı → sessiz rollback) — `createMany` ile düzeltildi + backfill script'i; parça araması Türkçe harflerde eşleşmiyordu; **prefetch tetikleme** araç kaydı anına ve Parça sekmesine genişledi; teknisyen yönetimi Ayarlar → Ekip'e taşındı; VIN'den araç tanıma **Pro pakete bağlandı**; Docker build'i lockfile'ı hiç uygulamıyordu → `bun install --frozen-lockfile`. Migration yok.

## 0.8.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.8.0 | İş emri kullanılabilirliği: birleşik parça composer, usta atama, üç katmanlı başlık | [v0.8.0](./docs/releases/v0.8.0.md) |

Öne çıkanlar: parça ekleme tek arama kutusuna indi + parça kutusu fotoğrafından OCR önerisi; **ustaya atama görünür hale geldi** (liste filtresi + mobil kart dahil); iş emri başlığı kimlik/durum/aksiyon olarak üç katmana ayrıldı; üst çubukta canlı global araç/müşteri araması; mobil sticky dip CTA barları kaldırıldı; araç kataloğu her deploy'da kendini seed'liyor. Migration yok.

## 0.7.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.7.0 | Canlı kartlı ödeme (TAMI), TecDoc parça kataloğu + VIN, Claude Vision OCR | [v0.7.0](./docs/releases/v0.7.0.md) |

Öne çıkanlar: **canlı kartlı ödeme (TAMI sanal POS)** — abonelik + kayıtta 1 TL 3DS ön provizyonla kart doğrulama gerçek merchant üzerinden; araca uygun **TecDoc parça seçici** + VIN→araç çözümleyici; ruhsat OCR **Claude Vision (Sonnet 5)**'a geçti (PaddleOCR sidecar emekli) + byte-hash dedup; iş emri **İşlem Geçmişi** (AuditLog). 7 migration.

## 0.6.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.6.1 | intake→orders birleşik akışı, PaddleOCR sidecar, AI advisor Claude göçü | tag `v0.6.1` |
| 0.6.0 | Onay→teslim & birleşik iş emri, para kuruş modeli, katalog/admin/e-posta | [v0.6.0](./docs/releases/v0.6.0.md) |

Öne çıkanlar: müşteri onayı kabulden **teslime** taşındı (iş emri direkt başlar) + WhatsApp (wa.me) gönder; birleşik iş emri akışı + teslim OTP; para modeli **Int kuruş/bps** + sunucu-otoriter toplamlar; DB tabanlı marka/model kataloğu; admin impersonation + işletme bazlı feature flag; transactional onay e-postaları; iş emri adımında plaka OCR; ruhsat tarayıcı sadeleştirme; landing redesign. 5 migration.

## 0.5.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.5.16 | Premium checkout sihirbazı | [v0.5.16](./docs/releases/v0.5.16.md) |
| 0.5.15 | Tarayıcı bellek düzeltmesi (OpenCV) | [v0.5.15](./docs/releases/v0.5.15.md) |
| 0.5.14 | Deploy senkron & landing | [v0.5.14](./docs/releases/v0.5.14.md) |
| 0.5.13 | Billing/satın alma akışı & release pipeline | [v0.5.13](./docs/releases/v0.5.13.md) |
| 0.5.12 | Ruhsat tarayıcı (OpenCV) & teknik borç | [v0.5.12](./docs/releases/v0.5.12.md) |
| 0.5.11 | Temiz URL'ler & AI gating | [v0.5.11](./docs/releases/v0.5.11.md) |
| 0.5.10 | RBAC/ekipler, admin & billing temeli | [v0.5.10](./docs/releases/v0.5.10.md) |
| 0.5.9 | Migration baseline & para tutarlılığı | [v0.5.9](./docs/releases/v0.5.9.md) |
| 0.5.8 | Tenant izolasyonu sertleştirme | [v0.5.8](./docs/releases/v0.5.8.md) |
| 0.5.7 | Üretim güvenlik bloklayıcıları | [v0.5.7](./docs/releases/v0.5.7.md) |
| 0.5.6 | Marka varlıkları & intake cilası | [v0.5.6](./docs/releases/v0.5.6.md) |
| 0.5.5 | Self-hosted yığına geçiş | [v0.5.5](./docs/releases/v0.5.5.md) |
| 0.5.0–0.5.4 | İletişim, billing/collections, ayarlar, UX | [docs/releases/](./docs/releases/) |

## Daha eski sürümler
v0.0.1 – v0.4.2 notları [`docs/releases/`](./docs/releases/) altındadır.
