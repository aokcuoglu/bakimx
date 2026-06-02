# BakimX

Oto servisler için dijital araç kabul, hasar kaydı, müşteri onayı ve iş emri platformu.

**Versiyon:** v0.2.0 — Dashboard & Operations Overview

## Hızlı Başlangıç

### Gereksinimler
- Node.js 18+ veya Bun
- PostgreSQL veritabanı (geliştirme için)

### Kurulum

```bash
# Repoyu klonlayın
git clone <repo-url>
cd bakimx

# Bağımlılıkları yükleyin
bun install

# .env dosyasını oluşturun
cp .env.example .env
# .env dosyasını düzenleyin: DATABASE_URL, SESSION_SECRET

# Veritabanını hazırlayın
bunx prisma db push
bunx prisma generate

# Demo verileri ekleyin (isteğe bağlı)
bun run db:seed

# Geliştirme sunucusunu başlatın
bun run dev
# http://localhost:3000
```

**Önemli:** Bu projede Docker kullanılmamaktadır. Lokal geliştirme bun/npm ile yapılır.

### Demo Giriş Bilgileri
- **E-posta:** `demo@bakimx.com`
- **Şifre:** `demo123456`

### Komutlar

| Komut | Açıklama |
|-------|----------|
| `bun run dev` | Geliştirme sunucusu |
| `bun run build` | Production build |
| `bun run start` | Production sunucusu |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript kontrolü |
| `bun run db:generate` | Prisma client oluştur |
| `bun run db:push` | Şemayı veritabanına uygula |
| `bun run db:migrate` | Migration oluştur |
| `bun run db:seed` | Demo veri ekle |
| `bun run db:studio` | Prisma Studio |
| `bun run db:validate` | Prisma şema doğrulama |

### Ortam Değişkenleri

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bakimx"
SESSION_SECRET="rastgele-32-karakter"
APP_URL="http://localhost:3000"
```

#### DATABASE_URL Davranışı
- `bun run build`, `DATABASE_URL` olmadan da çalışır (build-safe Prisma fallback)
- `bun run dev` çalıştırmak için geçerli bir `DATABASE_URL` gerekir
- Production'da `DATABASE_URL` zorunludur

#### Depolama (Storage) Ortam Değişkenleri

```env
# Varsayılan: mock (dosyalar bellekte tutulur, yeniden başlatmada kaybolur)
STORAGE_PROVIDER=mock

# Supabase Storage (STORAGE_PROVIDER=supabase iken gerekli)
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# SUPABASE_STORAGE_BUCKET=bakimx-media

# S3-compatible (henüz uygulanmadı — placeholder)
# S3_ENDPOINT=https://s3.amazonaws.com
# S3_REGION=us-east-1
# S3_ACCESS_KEY_ID=your-access-key
# S3_SECRET_ACCESS_KEY=your-secret-key
# S3_BUCKET=bakimx-media
# S3_FORCE_PATH_STYLE=false
```

**Depolama davranışı:**
- `STORAGE_PROVIDER` ayarlanmazsa veya `mock` ise: dosyalar bellekte base64 data URL olarak tutulur (sunucu yeniden başlatıldığında kaybolur). Geliştirme için uygundur.
- `STORAGE_PROVIDER=supabase`: Dosyalar Supabase Storage'a yüklenir. `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` zorunludur.
- `STORAGE_PROVIDER=s3`: Henüz uygulanmamıştır. Seçildiğinde açık hata mesajı gösterilir.
- Depolama ortam değişkenleri olmadan build ve运行 çalışır.
- `SUPABASE_SERVICE_ROLE_KEY` asla tarayıcıya açıklanmaz. Tüm yükleme işlemleri sunucu taraflı yapılır.

**Dosya kısıtlamaları:**
- İzin verilen MIME tipleri: `image/jpeg`, `image/png`, `image/webp`
- `image/heic` desteklenmez (açık hata mesajı ile reddedilir)
- Maksimum dosya boyutu: 8 MB
- Tüm depolama yolları tenant-scoped: `workshops/{workshopId}/intakes/{intakeFormId}/{photoType}/{photoId}-{safeFileName}`

---

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Dil:** TypeScript
- **CSS:** Tailwind CSS v4
- **UI:** shadcn/ui (base-nova, @base-ui/react)
- **ORM:** Prisma
- **Veritabanı:** PostgreSQL
- **Auth:** iron-session + bcryptjs
- **Validasyon:** Zod v4
- **Depolama:** Mock / Supabase Storage / S3 (placeholder)
- **Animasyon:** Framer Motion
- **İkon:** lucide-react

---

## v0.2.0 Özellikler

### Dashboard & Operations Overview (`/app`)

Tamamen yenilenmiş operasyonel gösterge paneli:

- **KPI Kartları**: 6 metrik — Aktif İş Emri, Bugün Teslim, Onay Bekleyen, Eksik Fotoğraf, Geciken Teslim, Son 7 Gün
- **Operasyonel Uyarı Banner'ı**: Geciken teslim, eksik fotoğraf, onay bekleyen uyarıları (gerçek veri, sıfırsa pozitif durum)
- **Aktif İş Emirleri**: Masaüstünde tablo (9 sütun), mobilde kart görünümü, fotoğraf/onay durumu rozetleri
- **Haftalık Operasyon Grafiği**: CSS bar chart — son 7 günlük iş emri trendi (sıfır bağımlılık)
- **Aylık İş Durumları Grafiği**: CSS progress bar ile durum dağılımı (sıfır bağımlılık)
- **Bugün Teslim Edilecekler**: Zaman bilgisi ve durum rozetli widget
- **Onay Bekleyenler**: Kabul ve iş emrine hızlı erişim
- **Eksik Fotoğraflar**: Zorunlu fotoğraf tiplerine göre eksik sayısı
- **Son Müşteriler**: Son 6 müşteri kaydı, telefon ve tarih bilgisi
- **Hızlı İşlemler**: 6 kısayol butonu (Yeni İş Emri, Yeni Müşteri, Yeni Araç, Onay Bekleyenler, Eksik Fotoğraflar, Bakiye Özeti)
- **Mobil Uyum**: 2 kolon KPI, tek kolon widget'lar, kart görünümü, dokunma dostu
- **Tenant İzolasyonu**: Tüm sorgular `workshopId` ile kapsamlı

### Dashboard Veri Katmanı (`src/lib/dashboard/queries.ts`)

8 adet workshop-scoped sunucu yardımcısı:
- `getDashboardStats` — 6 KPI değerini paralel sorgularla hesaplar
- `getActiveWorkOrders` — son 10 aktif iş emri (müşteri, araç, fotoğraf, toplam)
- `getTodayDeliveries` — bugün teslim edilecekler
- `getWaitingApprovals` — onay bekleyen iş emirleri
- `getMissingPhotoItems` — eksik fotoğraflı aktif iş emirleri
- `getRecentCustomers` — son 6 müşteri
- `getWeeklyOperations` — 7 günlük iş emri sayıları
- `getWorkStatusDistribution` — aylık durum dağılımı

### Hiçbir Grafik Kütüphanesi Eklenmedi
- Haftalık ve durum grafikleri saf CSS/SVG ile oluşturuldu
- `recharts` veya başka bir grafik kütüphanesi eklenmedi

### Tenant İzolasyonu
- Tüm dashboard sorguları `workshopId` ile kapsamlı
- Internal ID'ler sayfada görünmüyor

### Regresyon Güvenliği
- Tüm v0.1.5 rotaları çalışıyor
- Landing, auth, iş emirleri, müşteriler, araçlar, kabuller, public output, fotoğraf/storage, mock SMS, PDF etkilenmedi
- Hiçbir Docker dosyası eklenmedi

---

## v0.1.5 Özellikler

### Müşteri Yönetimi Yenileme
- **Müşteri Listesi (`/app/customers`)** — profesyonel tablo (masaüstü) + kart (mobil), tip filtresi, etiket filtresi, “Bakiye Özeti” ve “Yeni Müşteri” CTA'ları, “Excel İçe Aktar” placeholder
- **Yeni Müşteri (`/app/customers/new`)** — Bireysel/Kurumsal segmentli toggle, ana form + sağ yan panel (profil, izinler, KVKK), “Sesle Doldur” placeholder
- **Müşteri Detay (`/app/customers/[id]`)** — başlık, iletişim izinleri, bakiye özeti, araçlar, iş emirleri, kabul kayıtları, notlar, mobil uyumlu
- **Müşteri Bakiye Özeti (`/app/customers/balances`)** — temel KPI kartları, bakiye listesi, gerçek tahsilat modülü bağımlılığı olmadan iş emri toplamlarından türetilmiş

### Schema Genişletmeleri
- `Customer` tipi: `individual` | `corporate` enum (varsayılan `individual`)
- `Customer.firstName` ve `lastName` artık opsiyonel (geriye dönük uyumlu)
- Yeni alanlar: `fullName`, `companyName`, `contactName`, `phone2`, `city`, `district`, `address`, `identityNumber`, `taxNumber`, `taxOffice`, `notes`
- Yeni enum'lar: `CustomerTag` (standart | vip | riskli | filo), `CustomerSource` (tavsiye | google | sosyal medya | yoldan geldi | mevcut müşteri | diğer), `CustomerPriceGroup` (standart | indirimli | filo)
- `discountRate`, `riskNote`
- İletişim izinleri: `whatsappConsent`, `smsConsent`, `emailConsent` (boolean)
- `kvkkApprovedAt` (DateTime)
- Tüm alanlar geriye dönük uyumlu; mevcut kayıtlar etkilenmez

### Placeholder Özellikler
- “Excel İçe Aktar” butonu yalnızca UI placeholder (uygulanmadı)
- “Sesle Doldur” butonu yalnızca UI placeholder (uygulanmadı)
- Bakiye Özeti temel düzeydedir; tahsilat modülü henüz aktif değildir

### Tenant İzolasyonu
- Tüm müşteri sorguları `workshopId` ile kapsamlandı
- Müşteri oluşturma, güncelleme, silme, arama `requireAuth` + scoped Prisma
- Silme işlemi bağlı araç/kabul varsa güvenli hata döner

### Regresyon Güvenliği
- Tüm v0.1.4 rotaları çalışıyor
- Mevcut müşteri CRUD, araç CRUD, kabul, iş emri, public output, mock SMS, mock storage etkilenmedi
- İlk ad/soyad gösterimi `customerDisplayName` helper'ı ile null-safe
- Hiçbir Docker dosyası eklenmedi

---

## v0.1.4 Özellikler

### Korumalı Uygulama Kabuğu Yenileme
- Koyu lacivert sol kenar çubuğu (`#0F172A`)
- Gruplandırılmış modüller: Ana Panel, Servis, Depo & Finans, Analiz, Ayarlar
- Üst çubuk: sayfa başlığı, “Plaka, müşteri, iş emri ara” araması, “+ Yeni İş Emri” CTA, bildirim ikonu, kullanıcı menüsü
- Mobilde: drawer + alt navigasyon (4 sekme)
- Topbar araması `/app/orders?q=...` ile çalışır (plaka, müşteri, iş emri no, telefon)

### İş Emirleri Liste Sayfası
- Sayfa başlığı “İş Emirleri” + breadcrumb
- KPI kartları: Aktif, Tamamlandı, Teslim Edildi, İptal (tıklanabilir filtre)
- Filtreler: metin arama, durum (8 seçenek), ödeme (3 seçenek)
- Masaüstünde tablo, mobilde kart görünümü
- PlateBadge (lacivert monospace), StatusBadge, PaymentBadge

### Yeni İş Emri Sayfası
- “Yeni Araç Kabulü” veya “Kabullerden İş Emri Oluştur” iki yollu akış
- Uygun kabul kayıtlarını listeler, bir tıkla iş emri oluşturur

### İş Emri Detay Sayfası (Büyük Yenileme)
- İki sütunlu yerleşim (masaüstü), mobilde tek sütun
- Başlık: plaka rozeti, durum/ödeme rozetleri, müşteri, araç
- Durum geçiş butonları (geçerli sonraki durumlar)
- Müşteri & Araç kartı, Parçalar/İşçilikler kartı, Şikayet & Notlar kartı
- Hasar haritası ve fotoğraf galerisi özeti (kabul detayına link)
- **Sticky Fiyatlandırma paneli**: parça/işçilik toplamı, ara toplam, iskonto, KDV, genel toplam
- İskonto & KDV inline düzenleme
- İş Emri Bilgileri (teknisyen, tahmini teslim, notlar)
- Müşteri Çıktısı (public link, yazdır/PDF, WhatsApp paylaş)

### Schema Genişletmeleri
- `ServiceOrder`: `workOrderNo`, `paymentStatus`, `technicianName`, `estimatedDeliveryAt`, `discountAmount`, `taxRate`, `notes`
- Yeni `PaymentStatus` enum: `unpaid | partial | paid | cancelled`
- `OrderStatus` enum genişletildi: `waiting_approval`, `approved`, `waiting_parts`
- `ServiceOrderItem`: `sku`, `unit` (opsiyonel)
- Tüm yeni alanlar nullable → geriye dönük uyumlu
- `formatWorkOrderNo` eski kayıtlar için `BX-{son6}` fallback üretir
- `calculateOrderTotals` ve `formatOrderSummary` ortak tek hesap kaynağı

### Placeholder Modüller (Yakında)
- `/app/quotes`, `/app/appointments`, `/app/reminders`
- `/app/inventory`, `/app/suppliers`, `/app/cash`
- `/app/reports`
- Tümü uygulama kabuğu içinde, kenar çubuğunda “Yakında” rozeti

### Placeholder Özellikler (Gerçek Değil)
- “Plaka Tara”, “Sesle Doldur”, “Barkodla Ekle” butonları yalnızca UI placeholder
- Plaka tanıma / OCR entegrasyonu yakında
- Sesle doldurma entegrasyonu yakında
- Barkod entegrasyonu yakında

### Tenant İzolasyonu
- Tüm yeni sorgular `workshopId` ile kapsamlandı
- Ödeme ve meta güncellemeleri `requireAuth` + scoped Prisma
- Internal veriler public çıktıya sızmıyor

### Regresyon Güvenliği
- Tüm v0.1.3 rotaları çalışıyor
- Mock SMS, mock storage, public output, PDF, WhatsApp helper değişmedi
- Hiçbir Docker dosyası eklenmedi
- Hiçbir yeni zorunlu env değişkeni yok

---

## v0.1.3 Özellikler

### Depolama Sağlayıcı Mimarisi
- `lib/storage/types.ts` — `StorageProvider` arayüzü, yükleme doğrulama, yol oluşturma yardımcıları
- `lib/storage/mock-storage-provider.ts` — Bellek içi base64 depolama (lokal geliştirme için)
- `lib/storage/supabase-storage-provider.ts` — Supabase Storage entegrasyonu (signed URL desteği)
- `lib/storage/s3-storage-provider.ts` — S3 placeholder (seçildiğinde açık hata mesajı)
- `lib/storage/storage-provider.ts` — Async factory: `STORAGE_PROVIDER` env var ile sağlayıcı seçimi
- `STORAGE_PROVIDER=mock` varsayılan — depolama env var olmadan çalışır
- Dinamik import ile Supabase/S3 — sadece seçildiğinde yüklenir

### Supabase Storage Entegrasyonu
- `@supabase/supabase-js` bağımlılığı eklendi
- Yükleme, silme, signed URL desteği
- Service role key asla tarayıcıya açıklanmaz
- Public sayfalar signed URL veya proxy route ile görüntüler
- Tenant-scoped depolama yolları: `workshops/{workshopId}/intakes/{intakeFormId}/{photoType}/{photoId}-{safeFileName}`

### Kalıcı Fotoğraf Yükleme
- Fotoğraf çekme/yükleme artık gerçek depolama sağlayıcısını kullanır
- MIME tipi doğrulama (JPEG, PNG, WebP; HEIC reddedilir)
- Dosya boyutu doğrulama (maks 8 MB)
- Güvenli dosya adı normalizasyonu
- Yükleme sırasında ilerleme/gösterim durumu
- Dosya meta verileri kaydedilir: fileName, mimeType, sizeBytes, storageProvider, storageKey
- Mevcut kayıtlarla geriye dönük uyumlu (yeni alanlar nullable)

### Fotoğraf Değiştirme ve Silme
- `PUT /api/intakes/photos` — fotoğraf değiştirme (eski dosya silinir, yenisi yüklenir)
- `DELETE /api/intakes/photos` — fotoğraf silme (depolama dosyası + veritabanı kaydı)
- Her iki işlem audit log kaydı oluşturur
- Mock sağlayıcıda silme no-op

### Kimlik Doğrulamalı Fotoğraf Görüntüleme
- `GET /api/photos?id=...` — auth gerektirir, workshopId doğrular, signed URL döndürür
- Mock sağlayıcıda doğrudan blob döndürür
- Supabase sağlayıcıda signed URL yönlendirmesi

### Intake Medya Galerisi
- Kaydedilmiş fotoğraflar grid kart düzeninde gösterilir
- Fotoğraf tipine göre gruplandırma
- Zorunlu/opsiyonel durumu gösterilir
- Dosya adı, boyut, MIME tipi gösterilir
- "Tekrar çek / değiştir" butonu (yükleme durumlu)
- Silme butonu
- Mobil uyumlu, dokunmatik dostu

### Public Güvenli Fotoğraf Görüntüleme
- `/s/[token]/photos/[photoId]` — token tabanlı erişim (auth gerekmez)
- Token geçerliliği ve fotoğraf-workshop eşleşmesi doğrulanır
- Mock sağlayıcıda doğrudan blob, Supabase'de signed URL
- Fotoğraf yoksa professional placeholder gösterilir
- Storage key'ler doğrudan açıklanmaz
- İç ID'ler gizlenir (sadece photo ID token bağlamında kullanılır)

### Tenant İzolasyonu ve Güvenlik
- Her yükleme workshopId doğrular
- Her medya mutasyonu workshopId doğrular
- Depolama yolları workshopId ve intakeFormId içerir
- İstemci tarafından rastgele depolama yolu sağlanamaz
- İstemci workshopId güvenilmez
- Service role credentials açıklanmaz
- Public token route sadece token bağlamı üzerinden fotoğrafa erişir

### Audit Loglar
- `photo_uploaded` — fotoğraf yüklendi
- `photo_replaced` — fotoğraf değiştirildi
- `photo_deleted` — fotoğraf silindi
- `photo_upload_error` — yükleme hatası
- `photo_replace_error` — değiştirme hatası

### Doğrulama ve Hata Mesajları
- Tüm hata mesajları Türkçe
- Geçersiz dosya tipi: "Desteklenmeyen dosya tipi: {type}. İzin verilen tipler: JPEG, PNG, WebP."
- HEIC dosya: "HEIC formatı desteklenmemektedir. Lütfen JPEG, PNG veya WebP formatında yükleyiniz."
- Büyük dosya: "Dosya boyutu ({size} MB) çok büyük. Maksimum 8 MB olmalıdır."
- Eksik Supabase yapılandırması: "Supabase yapılandırması eksik..."

---

## Rotalar

### Genel
- `/` — Açılış sayfası
- `/privacy` — Gizlilik politikası
- `/terms` — Kullanım koşulları
- `/s/[token]` — Müşteri çıktı sayfası
- `/s/[token]/pdf` — Yazdırılabilir çıktı sayfası
- `/s/[token]/photos/[photoId]` — Public fotoğraf görüntüleme (token tabanlı)

### Auth
- `/login` — Giriş
- `/register` — Kayıt

### Panel (`/app/*`)
- `/app` — Genel Bakış (dashboard)
- `/app/workshop` — İş yeri profili
- `/app/customers` — Müşteri listesi (arama destekli)
- `/app/customers/new` — Yeni müşteri
- `/app/customers/[id]` — Müşteri detayı
- `/app/vehicles` — Araç listesi (arama destekli)
- `/app/vehicles/new` — Yeni araç
- `/app/intakes` — Kabul listesi (durum filtreli)
- `/app/intakes/new` — Yeni kabul sihirbazı
- `/app/intakes/[id]` — Kabul detayı (sekmeli, fotoğraf galerili)
- `/app/orders` — İş emri listesi (KPI'lar, filtreler, masaüstü tablosu, mobil kartları)
- `/app/orders/new` — Yeni iş emri (kabul seçici)
- `/app/orders/[id]` — İş emri detayı (sticky fiyat paneli, durum/ödeme)
- `/app/quotes` — Teklifler (Yakında)
- `/app/appointments` — Randevular (Yakında)
- `/app/reminders` — Bakım Hatırlatmaları (Yakında)
- `/app/inventory` — Stok / Parçalar (Yakında)
- `/app/suppliers` — Tedarikçiler (Yakında)
- `/app/cash` — Kasa (Yakında)
- `/app/reports` — Raporlar (Yakında)

### API
- `POST /api/intakes/photos` — Fotoğraf yükle (FormData, file dahil)
- `PUT /api/intakes/photos` — Fotoğraf değiştir
- `DELETE /api/intakes/photos` — Fotoğraf sil
- `GET /api/photos?id=` — Kimlik doğrulamalı fotoğraf görüntüle
- `POST /api/orders` — İş emri oluştur
- `POST /api/orders/[id]/status` — İş emri durum güncelle
- `POST /api/orders/[id]/payment` — Ödeme durumu güncelle
- `POST /api/orders/[id]/meta` — Teknisyen / tahmini teslim / iskonto / KDV / notlar
- `POST /api/orders/items` — Parça / işçilik ekle
- `DELETE /api/orders/items` — Parça / işçilik sil

---

## Tasarım Kimliği

- **Primary Navy:** #0B1F3A
- **Primary Blue:** #2563EB
- **Accent Sky:** #38BDF8
- **Soft Background:** #F8FAFC
- **Deep Sidebar (Mavi-Lacivert):** #0F172A

### Bileşen Stili (v0.1.4)
- **Kenar çubuğu:** koyu lacivert arka plan, beyaz / açık gri metin, aktif link mavi vurgu
- **Üst çubuk:** beyaz, ince alt border, hafif gölge
- **Kartlar:** beyaz arka plan, ince gri border (`border-slate-200`), `rounded-xl`, hafif gölge
- **Plaka rozeti:** monospace, koyu lacivert arka plan, beyaz metin
- **Durum rozetleri:** her durum için yumuşak renk + sınır (`bg-{renk}-100 text-{renk}-800 border-{renk}-200`)
- **Butonlar:** yuvarlatılmış köşeler, mavi primary, beyaz kart arka planı
- **KPI kartları:** renkli accent ikon, büyük rakam
- **Tablolar (masaüstü):** beyaz, çizgili satırlar, sticky başlık yok
- **Kartlar (mobil):** kompakt, badge + chevron, dokunma dostu
- **Gölgeler:** subtle, yoğun değil
- **Gürültülü gradyan:** yok
- **Turuncu/amber ana stil olarak:** kullanılmıyor (uyarı/durum rozetleri dışında)

---

## Sınırlamalar (v0.2.0)
- Gerçek SMS entegrasyonu yok (mock/demo modu, OTP production'da gizli)
- Gerçek OCR / plaka tanıma / VIN çıkarımı yok (placeholder)
- Gerçek sesle doldurma / barkod tarama yok (placeholder)
- “Excel İçe Aktar” yalnızca UI placeholder
- WhatsApp Business API yok (manuel paylaşım linki)
- @react-pdf/renderer sunucu PDF üretimi henüz aktif değil (print-optimized HTML mevcut)
- S3 depolama sağlayıcısı henüz uygulanmadı (placeholder)
- HEIC dosya desteği yok (açık hata mesajı ile reddedilir)
- İstemci tarafı görüntü sıkıştırma henüz uygulanmadı
- Ödeme / tahsilat modülü sadece etiket (Bakiye Özeti temel düzeydedir; iş emri toplamlarından türetilir, gerçek muhasebe verisi göstermez)
- E-fatura / e-arşiv / fatura modülü yok
- Çok şubeli kurumsal modül yok
- Stok, teklif, randevu, kasa, raporlar modülleri “Yakında” placeholder
- Docker konteyner desteği yok (lokal bun/npm)

---

## Sürümler

- [v0.2.0](docs/releases/v0.2.0.md) — Dashboard & Operations Overview (güncel)
- [v0.1.5](docs/releases/v0.1.5.md) — Müşteri Yönetimi UX Alignment
- [v0.1.4](docs/releases/v0.1.4.md) — İş Emri UX Alignment
- [v0.1.3](docs/releases/v0.1.3.md) — Image Storage & Intake Media Foundation
- [v0.1.2](docs/releases/v0.1.2.md) — Public Output & PDF Foundation
- [v0.1.1](docs/releases/v0.1.1.md) — Hardening & UX Polish
- [v0.1.0](docs/releases/v0.1.0.md) — MVP
- [v0.0.1](docs/releases/v0.0.1.md) — Başlangıç

## QA

- [v0.2.0 Manuel QA](docs/QA/v0.2.0-manual-checklist.md)
- [v0.1.5 Manuel QA](docs/QA/v0.1.5-manual-checklist.md)
- [v0.1.4 Manuel QA](docs/QA/v0.1.4-manual-checklist.md)
- [v0.1.3 Manuel QA](docs/QA/v0.1.3-manual-checklist.md)
- [v0.1.2 Manuel QA](docs/QA/v0.1.2-manual-checklist.md)
- [v0.1.1 Manuel QA](docs/QA/v0.1.1-manual-checklist.md)
- [v0.1.1 Tenant İzolasyonu QA](docs/QA/v0.1.1-tenant-isolation-checklist.md)