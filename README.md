# BakimX

Oto servisler için dijital araç kabul, hasar kaydı, müşteri onayı ve iş emri platformu.

**Versiyon:** v0.1.2 — Public Output & PDF Foundation

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
- **Animasyon:** Framer Motion
- **İkon:** lucide-react

---

## v0.1.1 Özellikler

### Tenant İzolasyonu
- Tüm veritabanı sorguları `workshopId` ile kapsamlandırılmıştır
- Cross-workshop veri erişimi engellenmiştir
- `getCurrentUserWithWorkshop()`, `assertWorkshopAccess()` yardımcı fonksiyonları

### Auth & Session
- iron-session tabanlı oturum yönetimi
- Oturum açmış kullanıcılar `/login` ve `/register`'dan yönlendirilir
- Güvenli cookie ayarları (httpOnly, secure, sameSite)
- E-posta normalizasyonu ve validasyonu

### Mobil UX
- Mobile-first tasarım
- Dokunmatik dostu butonlar (min 48px)
- Mobil alt navigasyon
- Kart/liste tabanlı görünüm
- Açıklayıcı boş durum ve hata mesajları

### Araç Kabul Sihirbazı
- 6 adımlı progress bar
- Müşteri ve araç seçimi/oluşturma
- Zorunlu alan validasyonları
- Fotoğraf kontrol listesi
- 2D SVG araç hasar işaretleme
- Mock SMS onay (demo modu)

### Müşteri Arama
- Ad, soyad, telefon ile arama (sunucu taraflı filtreleme)
- Araç plaka, marka, model, müşteri adı ile arama
- `workshopId` kapsamında güvenli
- Sonuç bulunamadığında boş durum gösterimi
- Mobil uyumlu arama girdisi

### Müşteri Çıktı Sayfası (`/s/[token]`)
- Token tabanlı güvenli erişim
- BakimX markalı profesyonel tasarım (navy/blue kimlik)
- Geçersiz/token süresi dolmuş sayfalar için markalı hata sayfası
- Yazdır / PDF olarak kaydet (tarayıcı `window.print()`)
- Yazdırılabilir sayfa `/s/[token]/pdf` endpoint
- WhatsApp ile paylaşım butonu
- Link kopyalama butonu
- Print-friendly CSS
- Servis emri parça/işçilik ayrımlı toplamları
- Yasal sorumluluk reddi bildimi
- İç ID'ler gizlenmiş, müşteri verileri güvenli

### WhatsApp Paylaşım
- `lib/share/whatsapp.ts` ile Türkçe paylaşım metni üretimi
- wa.me URL ile manuel paylaşım linki
- Toplam tutar opsiyonel ekleme
- WhatsApp Business API entegrasyonu yok (sadece link üretimi)

### Servis Emri Toplamları
- Parça/işçilik ayrımlı detaylı toplamlar
- Merkezi `lib/totals.ts` yardımcı modülü
- Eksik fiyatlar için "Fiyat girilmedi" göstergesi
- TRY formatlaması (Intl.NumberFormat)
- Null/undefined fiyat güvenli hesaplama
- Kabul detayı, servis emri ve çıktı sayfasında tutarlı gösterim

### Hasar İşaretleme
- SVG araç gövdesi üzerinde tıklanabilir 20 bölge
- Hasar tipi: Çizik, Göçük, Kırık, Çatlak, Boya hasarı, Eksik parça, Diğer
- Şiddet seviyesi: Hafif, Orta, Ağır
- Renk kodlu görsel legend
- Hasar ekleme/silme

### Photo Capture UI (MVP)
- Her fotoğraf kontrol listesi öğesi için kamera/galeri input (`capture="environment"`)
- İstemci tarafı `object URL` ile anlık önizleme
- "Fotoğraf çek / yükle" ve "Tekrar çek / değiştir" aksiyonları
- Gerçek dosya yükleme henüz aktif değil — Supabase/S3 gelecek sürümlerde

### Mock SMS Onay
- Demo modunda SMS gönderilmez
- Test kodu yalnızca development/demo ortamında API yanıtında döner
- Production'da OTP kodu API yanıtında gönderilmez
- Gerçek SMS entegrasyonu sonraki sürümlerde planlanmaktadır

### Oturum Güvenliği
- Production'da `SESSION_SECRET` zorunludur ve en az 32 karakter olmalıdır
- Local dev için fallback korunur

### Müşteri Çıktı Sayfası (`/s/[token]`)
- Token tabanlı güvenli erişim
- BakimX markalı profesyonel tasarım
- Yazdır / PDF kaydet (tarayıcı `window.print()`)
- Print-friendly CSS
- WhatsApp ile paylaşım için kullanılabilir

### Servis Emri
- Parça ve işçilik kalemleri
- TRY para birimi formatlaması
- Parça/işçilik toplamları ayrı gösterim
- Genel toplam
- Durum takibi

### Storage Altyapısı
- `lib/storage/` temiz soyutlama katmanı
- Mock depolama sağlayıcısı (lokal geliştirme için)
- Supabase Storage provider placeholder (`supabase-storage-provider.ts`)
- S3-compatible provider placeholder (`s3-storage-provider.ts`)
- `STORAGE_PROVIDER` env var desteği (factory)
- Storage env vars olmadan build çalışır
- Eksik fotoğraf URL'leri için yer tutacı mesajı

### Audit Log
- Müşteri/Araç/Kabul oluşturma
- Durum değişiklikleri
- Onay talebi ve doğrulama
- Servis emri ve kalem işlemleri
- Paylaşım linki oluşturma

---

## Rotalar

### Genel
- `/` — Açılış sayfası
- `/privacy` — Gizlilik politikası
- `/terms` — Kullanım koşulları
- `/s/[token]` — Müşteri çıktı sayfası
- `/s/[token]/pdf` — Yazdırılabilir çıktı sayfası

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
- `/app/intakes/[id]` — Kabul detayı (sekmeli)
- `/app/orders` — Servis emri listesi
- `/app/orders/[id]` — Servis emri detayı

---

## Tasarım Kimliği

- **Primary Navy:** #0B1F3A
- **Primary Blue:** #2563EB
- **Accent Sky:** #38BDF8
- **Soft Background:** #F8FAFC
- **Deep Background:** #0F172A

---

## Sınırlamalar (v0.1.1)

- Gerçek SMS entegrasyonu yok (mock/demo modu, OTP production'da gizli)
- Gerçek OCR entegrasyonu yok
- Gerçek dosya yükleme/storage yok (kamera UI mevcut, Supabase/S3 placeholder hazır)
- @react-pdf/renderer sunucu PDF üretimi henüz aktif değil (print-optimized HTML mevcut)
### PDF / Print Foundation
- `/s/[token]/pdf` — yazdırılabilir HTML endpoint
- `@react-pdf/renderer` bağımlılığı eklendi (gelecek sunucu PDF)
- `components/pdf/public-output-document.tsx` — React PDF bileşeni (temel)
- Tarayıcı print butonu ile PDF kaydetme
- Yasal sorumluluk reddi PDF çıktısında dahil
- İç ID'ler PDF çıktısında gizlenmiş
- Ödeme/fatura modülü yok
- WhatsApp Business API yok
- Docker konteyner desteği yok (lokal bun/npm)
- Gelişmiş tam metin arama yok (basit contains/startswith)

---

## Sürümler

- [v0.1.2](docs/releases/v0.1.2.md) — Public Output & PDF Foundation (güncel)
- [v0.1.1](docs/releases/v0.1.1.md) — Hardening & UX Polish
- [v0.1.0](docs/releases/v0.1.0.md) — MVP
- [v0.0.1](docs/releases/v0.0.1.md) — Başlangıç

## QA

- [v0.1.2 Manuel QA](docs/QA/v0.1.2-manual-checklist.md)
- [v0.1.1 Manuel QA](docs/QA/v0.1.1-manual-checklist.md)
- [v0.1.1 Tenant İzolasyonu QA](docs/QA/v0.1.1-tenant-isolation-checklist.md)
