# BakimX

Oto servisler için dijital araç kabul, hasar kaydı, müşteri onayı ve iş emri platformu.

**Versiyon:** v0.1.3 — Image Storage & Intake Media Foundation

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
- `/app` — Dashboard
- `/app/workshop` — İş yeri profili
- `/app/customers` — Müşteri listesi (arama destekli)
- `/app/customers/new` — Yeni müşteri
- `/app/customers/[id]` — Müşteri detayı
- `/app/vehicles` — Araç listesi (arama destekli)
- `/app/vehicles/new` — Yeni araç
- `/app/intakes` — Kabul listesi (durum filtreli)
- `/app/intakes/new` — Yeni kabul sihirbazı
- `/app/intakes/[id]` — Kabul detayı (sekmeli, fotoğraf galerili)
- `/app/orders` — Servis emri listesi
- `/app/orders/[id]` — Servis emri detayı

### API
- `POST /api/intakes/photos` — Fotoğraf yükle (FormData, file dahil)
- `PUT /api/intakes/photos` — Fotoğraf değiştir
- `DELETE /api/intakes/photos` — Fotoğraf sil
- `GET /api/photos?id=` — Kimlik doğrulamalı fotoğraf görüntüle

---

## Tasarım Kimliği

- **Primary Navy:** #0B1F3A
- **Primary Blue:** #2563EB
- **Accent Sky:** #38BDF8
- **Soft Background:** #F8FAFC
- **Deep Background:** #0F172A

---

## Sınırlamalar (v0.1.3)

- Gerçek SMS entegrasyonu yok (mock/demo modu, OTP production'da gizli)
- Gerçek OCR entegrasyonu yok
- WhatsApp Business API yok
- @react-pdf/renderer sunucu PDF üretimi henüz aktif değil (print-optimized HTML mevcut)
- S3 depolama sağlayıcısı henüz uygulanmadı (placeholder)
- HEIC dosya desteği yok (açık hata mesajı ile reddedilir)
- İstemci tarafı görüntü sıkıştırma henüz uygulanmadı (dosya boyutu sınırı uygulanır)
- Ödeme/fatura modülü yok
- Docker konteyner desteği yok (lokal bun/npm)

---

## Sürümler

- [v0.1.3](docs/releases/v0.1.3.md) — Image Storage & Intake Media Foundation (güncel)
- [v0.1.2](docs/releases/v0.1.2.md) — Public Output & PDF Foundation
- [v0.1.1](docs/releases/v0.1.1.md) — Hardening & UX Polish
- [v0.1.0](docs/releases/v0.1.0.md) — MVP
- [v0.0.1](docs/releases/v0.0.1.md) — Başlangıç

## QA

- [v0.1.3 Manuel QA](docs/QA/v0.1.3-manual-checklist.md)
- [v0.1.2 Manuel QA](docs/QA/v0.1.2-manual-checklist.md)
- [v0.1.1 Manuel QA](docs/QA/v0.1.1-manual-checklist.md)
- [v0.1.1 Tenant İzolasyonu QA](docs/QA/v0.1.1-tenant-isolation-checklist.md)