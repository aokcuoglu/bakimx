# Changelog

BakımX sürüm geçmişi. Her sürümün ayrıntılı notu [`docs/releases/`](./docs/releases/) altındadır. Sürümler [SemVer](https://semver.org/lang/tr/) ve dev→staging→main akışını izler (bkz. [RELEASE.md](./RELEASE.md)).

## Yayınlanmamış (Unreleased)
Henüz yok — v0.9.0 tag'lendi, sonraki sürüm için birikmiş tag'siz geliştirme bulunmuyor.

## 0.9.x

| Sürüm | Başlık | Not |
|---|---|---|
| 0.9.0 | Parça veri boru hattı onarımı, prefetch tetikleme, deterministik Docker build | [v0.9.0](./docs/releases/v0.9.0.md) |

Öne çıkanlar: katalog parçaları **veritabanına yazılamıyordu** (5 sn transaction sınırı → sessiz rollback) — `createMany` ile düzeltildi + backfill script'i; parça araması Türkçe harflerde eşleşmiyordu; **prefetch tetikleme** araç kaydı anına ve Parça sekmesine genişledi; teknisyen yönetimi Ayarlar → Ekip'e taşındı; VIN'den araç tanıma **Pro pakete bağlandı**; Docker build'i lockfile'ı hiç uygulamıyordu → `bun install --frozen-lockfile`. Migration yok.

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
