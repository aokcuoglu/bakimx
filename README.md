# BakimX

Oto servisler için dijital araç kabul, hasar kaydı, müşteri onayı ve iş emri platformu.

**Versiyon:** v0.5.2 — Billing & Collections Enhancement

## Hızlı Başlangıç

### Gereksinimler
- Bun (veya Node.js 18+)
- OrbStack veya Docker Desktop (PostgreSQL + MinIO için)

### Kurulum

```bash
# Repoyu klonlayın
git clone <repo-url>
cd bakimx

# Bağımlılıkları yükleyin
bun install

# Yerel altyapıyı başlatın (PostgreSQL + MinIO)
docker compose -f docker-compose.local.yml up -d

# .env.local dosyasını oluşturun
cp .env.example .env.local
# .env.local dosyasını düzenleyin — yerel geliştirme için varsayılanlar:
#   DATABASE_URL="postgresql://bakimx:bakimx@localhost:5432/bakimx"
#   STORAGE_PROVIDER=s3
#   S3_ENDPOINT=http://localhost:9000
#   S3_ACCESS_KEY_ID=bakimx
#   S3_SECRET_ACCESS_KEY=bakimx-dev-secret
#   S3_BUCKET=bakimx-media
#   S3_FORCE_PATH_STYLE=true

# Veritabanını hazırlayın (migration'ları uygula + demo veri)
bun run db:deploy
bun run db:seed

# Geliştirme sunucusunu başlatın
bun run dev
# http://localhost:3000
```

**Mimari:** Uygulama host üzerinde `bun run dev` ile çalışır. PostgreSQL ve MinIO (S3-compatible storage) OrbStack/Docker içinde `docker-compose.local.yml` ile koşar.

**MinIO Console:** http://localhost:9001 (bakimx / bakimx-dev-secret)

### Yerel Altyapı Komutları

```bash
# Servisleri başlat (PostgreSQL + MinIO)
docker compose -f docker-compose.local.yml up -d

# Servisleri durdur
docker compose -f docker-compose.local.yml down

# Veritabanı + Storage'ı sıfırla (SADECE LOKAL, tüm veriler silinir)
# Guard'lı wrapper — yanlışlıkla prod'u silmeyi engeller. Doğrudan `down -v` KULLANMAYIN.
./scripts/local-reset.sh
```

| Servis | Port | Erişim |
|--------|------|--------|
| PostgreSQL | 5432 | `postgresql://bakimx:bakimx@localhost:5432/bakimx` |
| MinIO API | 9000 | S3-compatible endpoint |
| MinIO Console | 9001 | http://localhost:9001 (bakimx / bakimx-dev-secret) |

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
| `bun run db:push` | Şemayı doğrudan uygula (yalnız hızlı prototip; migration üretmez) |
| `bun run db:migrate` | Migration oluştur + lokale uygula (`prisma migrate dev`) |
| `bun run db:deploy` | Migration'ları uygula (prod yöntemi, `prisma migrate deploy`) |
| `bun run db:seed` | Demo veri ekle (prod'da bloklanır) |
| `bun run db:studio` | Prisma Studio |
| `bun run db:validate` | Prisma şema doğrulama |

### Ortam Değişkenleri

#### Lokal Geliştirme (Varsayılanlar)

```env
DATABASE_URL="postgresql://bakimx:bakimx@localhost:5432/bakimx"
DIRECT_URL="postgresql://bakimx:bakimx@localhost:5432/bakimx"
SESSION_SECRET="rastgele-32-karakter"
APP_URL="http://localhost:3000"

STORAGE_PROVIDER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=bakimx
S3_SECRET_ACCESS_KEY=bakimx-dev-secret
S3_BUCKET=bakimx-media
S3_FORCE_PATH_STYLE=true
```

#### DATABASE_URL Davranışı
- `bun run build`, `DATABASE_URL` olmadan da çalışır (build-safe Prisma fallback)
- `bun run dev` çalıştırmak için geçerli bir `DATABASE_URL` gerekir
- Production'da `DATABASE_URL` zorunludur

#### Depolama (Storage) Ortam Değişkenleri

```env
# Yerel geliştirme: MinIO (S3-compatible) — docker-compose.local.yml ile otomatik başlar
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=bakimx
S3_SECRET_ACCESS_KEY=bakimx-dev-secret
S3_BUCKET=bakimx-media
S3_FORCE_PATH_STYLE=true

# Alternatif: mock (dosyalar bellekte tutulur, yeniden başlatmada kaybolur)
# STORAGE_PROVIDER=mock

# Üretim: Cloudflare R2 (STORAGE_PROVIDER=s3)
# S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
# S3_REGION=auto
# S3_ACCESS_KEY_ID=your-r2-access-key-id
# S3_SECRET_ACCESS_KEY=your-r2-secret-access-key
# S3_BUCKET=bakimx-media
# S3_FORCE_PATH_STYLE=true
# S3_PUBLIC_DOMAIN=pub-YOUR_HASH.r2.dev
```

### OCR Ortam Değişkenleri

```env
# Varsayılan: mock (demo verisi döndürür, API anahtarı gerekmez)
OCR_PROVIDER=mock

# Gerçek OCR için: deepseek, openai, veya tesseract
# OCR_PROVIDER=deepseek
# OCR_PROVIDER=openai
# OCR_PROVIDER=tesseract

# Sağlayıcıdan bağımsız model override (opsiyonel)
# OCR_MODEL=gpt-4o

# DeepSeek (OCR_PROVIDER=deepseek iken gerekli)
# DEEPSEEK_API_KEY=your-key
# DEEPSEEK_OCR_MODEL=deepseek-chat

# OpenAI (OCR_PROVIDER=openai iken gerekli)
# OPENAI_API_KEY=your-key
# OPENAI_OCR_MODEL=gpt-4o

# Tesseract (OCR_PROVIDER=tesseract) — yerel OCR, API anahtarı gerekmez
# Doğruluk DeepSeek/OpenAI'dan düşüktür; fallback olarak önerilir
```

**OCR davranışı:**
- `OCR_PROVIDER` ayarlanmazsa veya `mock` ise: sabit demo verisi döndürülür, API anahtarı gerekmez
- `OCR_PROVIDER=deepseek`: Tesseract yerel metin çıkarma + DeepSeek JSON alan eşleme; `DEEPSEEK_API_KEY` zorunlu, `DEEPSEEK_OCR_MODEL` veya `OCR_MODEL` zorunlu
- `OCR_PROVIDER=openai`: OpenAI Responses API vision OCR; `OPENAI_API_KEY` zorunlu, `OPENAI_OCR_MODEL` veya `OCR_MODEL` zorunlu
- `OCR_PROVIDER=tesseract`: Yalnızca yerel Tesseract metin çıkarma; API anahtarı gerekmez, doğruluk düşük
- `OCR_MODEL` ortam değişkeni, sağlayıcıya özel model ayarını override eder
- Eksik API anahtarı durumunda açık Türkçe hata mesajı gösterilir; sahte veri üretilmez
- HEIC/HEIF dosyaları sunucuda JPEG'e dönüştürülerek okunur
- Maksimum görsel boyutu 8 MB; desteklenen MIME tipleri: JPEG, PNG, WebP, HEIC, HEIF
- Hem JSON body (data URL) hem de multipart/form-data yükleme desteklenir
- Kullanıcı onayı zorunludur — OCR sonucu otomatik kaydedilmez
- Düşük güven oranlı alanlar sarı vurgu ile işaretlenir

### AI Servis Danışmanı Ortam Değişkenleri

```env
# Varsayılan: mock (demo önerileri döndürür, API anahtarı gerekmez)
AI_PROVIDER=mock

# Gerçek AI için: openai veya deepseek
# AI_PROVIDER=openai
# AI_PROVIDER=deepseek

# Sağlayıcıdan bağımsız model override (opsiyonel)
# AI_MODEL=gpt-4o-mini

# OpenAI (AI_PROVIDER=openai iken gerekli)
# OPENAI_API_KEY=your-key (OCR ile paylaşımlı)
# AI_MODEL=gpt-4o-mini

# DeepSeek (AI_PROVIDER=deepseek iken gerekli)
# DEEPSEEK_API_KEY=your-key (OCR ile paylaşımlı)
# AI_MODEL=deepseek-chat
```

**AI danışman davranışı:**
- `AI_PROVIDER` ayarlanmazsa veya `mock` ise: anahtar kelime eşlemeli demo önerileri döndürülür, API anahtarı gerekmez
- `AI_PROVIDER=openai`: OpenAI Chat Completions API; `OPENAI_API_KEY` zorunlu, `AI_MODEL` opsiyonel (varsayılan: gpt-4o-mini)
- `AI_PROVIDER=deepseek`: DeepSeek Chat API; `DEEPSEEK_API_KEY` zorunlu, `AI_MODEL` opsiyonel (varsayılan: deepseek-chat)
- `AI_MODEL` ortam değişkeni, sağlayıcıya özel model ayarını override eder

### İletişim Ortam Değişkenleri

```env
# SMS Sağlayıcı — mock (varsayılan) veya netgsm
SMS_PROVIDER=mock

# Netgsm (SMS_PROVIDER=netgsm iken gerekli)
# NETGSM_USERCODE=your-netgsm-usercode
# NETGSM_PASSWORD=your-netgsm-password
# NETGSM_SENDER=BAKIMX
# NETGSM_API_URL=https://api.netgsm.com.tr/sms/send/get

# WhatsApp Sağlayıcı — mock (varsayılan) veya business
WHATSAPP_PROVIDER=mock

# WhatsApp Business API (WHATSAPP_PROVIDER=business iken gerekli)
# WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
# WHATSAPP_ACCESS_TOKEN=your-access-token
# WHATSAPP_API_URL=https://graph.facebook.com/v18.0

# E-posta Sağlayıcı — mock (varsayılan) veya resend
EMAIL_PROVIDER=mock

# Resend (EMAIL_PROVIDER=resend iken gerekli)
# RESEND_API_KEY=your-resend-api-key
# RESEND_FROM_EMAIL=no-reply@bakimx.com
# RESEND_FROM_NAME=BakimX
# RESEND_API_URL=https://api.resend.com/emails
```

**İletişim davranışı:**
- Tüm sağlayıcılar `mock` olarak varsayılan — API anahtarı gerekmez, konsola log yazar
- `SMS_PROVIDER=netgsm`: Netgsm SMS API ile gerçek SMS gönderimi
- `WHATSAPP_PROVIDER=business`: WhatsApp Business API ile mesaj gönderimi (template message API henüz yok)
- `EMAIL_PROVIDER=resend`: Resend API ile gerçek e-posta gönderimi
- Her sağlayıcı soyut arayüz ile değiştirilebilir, yeni sağlayıcılar eklenebilir

### Zamanlanmış Hatırlatmalar (Cron)

Randevu hatırlatmaları ve bakım hatırlatmaları için bir cron endpoint bulunur:

```bash
# Her saat çalıştır (Vercel Cron, Upstash QStash veya manuel tetikleyici)
curl -X POST https://your-domain.com/api/cron/reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Ortam değişkeni:**
```env
# TÜM ortamlarda zorunlu — cron endpoint'ini yetkisiz erişime karşı korur
CRON_SECRET=change-me-to-a-long-random-string
```

- `CRON_SECRET` **tüm ortamlarda zorunludur**; ayarlanmazsa endpoint 500 döndürür (asla herkese açık olmaz)
- Bearer token eşleşmezse endpoint 401 döndürür (sabit-zamanlı karşılaştırma)
- Eksik API anahtarı durumunda açık Türkçe hata mesajı gösterilir; sahte veri üretilmez
- AI sonucu tavsiye niteliğindedir, kesin arıza teşhisi değildir
- Önerilen kalemler otomatik eklenmez — kullanıcı onayı zorunludur
- `rawResponse` API yanıtlarında yer almaz; yalnızca geliştirme modunda sunucu loglarında görünür

### Takvim Ortam Değişkenleri

```env
# Takvim Sağlayıcı — mock (varsayılan) veya google
CALENDAR_PROVIDER=mock

# Google Calendar (CALENDAR_PROVIDER=google iken gerekli)
# GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
# GOOGLE_CALENDAR_ACCESS_TOKEN=your-access-token
# GOOGLE_CALENDAR_API_URL=https://www.googleapis.com/calendar/v3
```

**Takvim davranışı:**
- `CALENDAR_PROVIDER` ayarlanmazsa veya `mock` ise: takvim etkinlikleri uygulama içinde gösterilir, harici senkronizasyon yapılmaz
- `CALENDAR_PROVIDER=google`: Google Calendar API v3 ile randevu, teslimat ve bakım hatırlatmalarını senkronize eder
- Kimlik bilgileri eksikse `google` sağlayıcısı otomatik olarak mock'a döner (hata vermez)
- `OPENAI_API_KEY` ve `DEEPSEEK_API_KEY` OCR sağlayıcısı ile paylaşımlıdır

**Depolama davranışı:**
- `STORAGE_PROVIDER` ayarlanmazsa veya `mock` ise: dosyalar bellekte base64 data URL olarak tutulur (sunucu yeniden başlatıldığında kaybolur). Hızlı geliştirme için uygundur.
- `STORAGE_PROVIDER=s3`: MinIO (lokal) veya Cloudflare R2 (üretim) ile S3-compatible depolama. `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` zorunludur. Lokal geliştirme için `docker-compose.local.yml` ile MinIO otomatik başlar.
- Depolama ortam değişkenleri olmadan build çalışır.
- Tüm yükleme işlemleri sunucu taraflı yapılır; erişim presigned URL ile sağlanır.

**Dosya kısıtlamaları:**
- İzin verilen MIME tipleri: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`
- Maksimum dosya boyutu: 8 MB (HEIC dönüştürme sonrası da kontrol edilir)
- Hem JSON body (data URL) hem de multipart/form-data yükleme desteklenir
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
- **Depolama:** Mock / S3-compatible (MinIO local / Cloudflare R2 production)
- **OCR:** Tesseract + DeepSeek / OpenAI vision / Tesseract-only / Mock demo sağlayıcısı
- **AI Danışman:** Mock / OpenAI / DeepSeek servis danışmanı
- **Animasyon:** Framer Motion
- **İkon:** lucide-react

---

## v0.5.0 Özellikler

### Real Communication Integrations

- **İletişim sağlayıcı mimarisi** (`src/lib/communications/`) — SMS, WhatsApp ve e-posta için soyut sağlayıcı sistemi
- **SMS sağlayıcılar** — MockSMSProvider (varsayılan), NetgsmProvider
- **WhatsApp sağlayıcılar** — MockWhatsAppProvider (varsayılan), WhatsAppBusinessProvider (temel)
- **E-posta sağlayıcılar** — MockEmailProvider (varsayılan), ResendProvider
- **Ortam değişkenleri** — `SMS_PROVIDER`, `WHATSAPP_PROVIDER`, `EMAIL_PROVIDER` ile sağlayıcı seçimi
- **Bildirim Merkezi** (`/app/settings/notifications`) — 8 şablon türü için SMS, WhatsApp, e-posta şablon yönetimi
- **İletişim Kayıtları** (`/app/communications`) — Tüm iletişimlerin log tablosu, filtreleme, istatistikler
- **Randevu bildirimleri** — Oluşturma ve hatırlatma bildirimleri
- **Araç kabul onay bildirimi** — SMS ve WhatsApp onay linki gönderimi
- **Teklif bildirimi** — Teklif gönderildiğinde müşteriye bildirim
- **İş emri tamamlama bildirimi** — Araç teslimata hazır + ödeme hatırlatma
- **Bakım hatırlatma otomasyonu** — Yaklaşan ve gecikmiş bakım bildirimleri
- **Müşteri iletişim tercihleri** — SMS, WhatsApp, e-posta onay kutuları
- **Rate limiting** — Müşteri başına kanal başına dakikada 30 mesaj limiti
- **Şablon sanitizasyonu** — `<script>`, event handler ve `javascript:` temizleme
- **Workshop kapsamlı loglar** — Tenant izolasyonu iletişim kayıtlarında

### Yeni Dosyalar

- `src/lib/communications/types.ts` — İletişim tip tanımları
- `src/lib/communications/templates.ts` — Şablon sistemi, varsayılanlar, render
- `src/lib/communications/sender.ts` — Gönderim mantığı, tercih kontrolü, loglama
- `src/lib/communications/rate-limit.ts` — Rate limiting temeli
- `src/lib/communications/index.ts` — Genel API
- `src/lib/communications/sms/index.ts` — SMS sağlayıcı fabrikası
- `src/lib/communications/whatsapp/index.ts` — WhatsApp sağlayıcı fabrikası
- `src/lib/communications/email/index.ts` — E-posta sağlayıcı fabrikası
- `src/lib/communications/providers/mock-sms-provider.ts`
- `src/lib/communications/providers/netgsm-provider.ts`
- `src/lib/communications/providers/mock-whatsapp-provider.ts`
- `src/lib/communications/providers/whatsapp-business-provider.ts`
- `src/lib/communications/providers/mock-email-provider.ts`
- `src/lib/communications/providers/resend-provider.ts`
- `src/lib/communications/triggers.ts` — Tüm bildirim tetik fonksiyonları
- `src/app/app/settings/notifications/page.tsx` — Bildirim ayarları sayfası
- `src/app/app/settings/notifications/actions.ts`
- `src/app/app/communications/page.tsx` — İletişim kayıtları sayfası
- `src/app/app/communications/actions.ts`
- `src/app/api/communications/templates/route.ts`
- `src/app/api/communications/logs/route.ts`
- `src/app/api/communications/preferences/route.ts`
- `src/components/app/notification-settings.tsx`
- `src/components/app/communication-log-list.tsx`

### Değiştirilen Dosyalar

- `prisma/schema.prisma` — CommunicationType, CommunicationStatus enum'ları; CommunicationTemplate, CommunicationLog modelleri
- `src/app/app/appointments/actions.ts` — Randevu bildirim tetikleyicisi
- `src/app/app/intakes/approval-actions.ts` — Kabul onayı bildirim tetikleyicisi
- `src/app/app/quotes/actions.ts` — Teklif gönderildi bildirim tetikleyicisi
- `src/app/app/orders/actions.ts` — İş emri tamamlama + ödeme hatırlatma tetikleyicileri
- `src/app/app/reminders/actions.ts` — Bakım hatırlatma bildirim tetikleyicisi
- `src/components/app/app-shell.tsx` — İletişim ve Bildirim Ayarları navigasyonu
- `src/lib/constants.ts` — İletişim tip/durum/şablon etiketleri
- `src/lib/validation.ts` — communicationTemplateSchema, customerPreferencesSchema
- `middleware.ts` — /api/communications korumalı rotalar
- `.env.example` — SMS_PROVIDER, WHATSAPP_PROVIDER, EMAIL_PROVIDER ve sağlayıcı değişkenleri

---

## v0.4.2 Özellikler

### Operational Analytics

- **Operasyonel Analiz sayfası** (`/app/analytics`) — Atölye operasyonel sağlığı ve performans metrikleri
- **Sağlık Skoru** (0-100) — Geciken iş emirleri, kritik stok ve ödenmemiş iş emirleri baz alınarak hesaplanır
- **Sağlık Skoru görselleştirmesi** — Renk kodlu halka grafik (yeşil 80+, sarı 50-79, kırmızı <50)
- **Metrik kartları** — Aktif iş emri, geciken iş emri, onay bekleyen, kritik stok, açık alacak
- **Geciken İş Emirleri** — Tahmini teslim tarihi geçmiş iş emirleri, gecikme günü, teknisyen, müşteri bilgisi
- **Teknisyen Analizi** — Ortalama tamamlama süresi, aktif iş yükü, tamamlanan iş, en hızlı ve en yoğun teknisyen sıralamaları
- **Müşteri Analizi** — Toplam müşteri, bu ay yeni, geri dönüş oranı (%), pasif müşteri (90+ gün), en yüksek değerli müşteriler
- **Parça & Stok Analizi** — Toplam parça, stok değeri, kritik stok, tükenen stok, en çok tüketilen parçalar, stok risk listesi
- **Gelir Analizi** — Toplam tahsilat, açık alacak, ort. iş emri tutarı, iş emri başına gelir, 6 aylık tahsilat trendi
- **Servis Analizi** — En sık şikayetler, en sık onarımlar, en çok yapılan işçilikler (gelir ile)
- **Öneri Motoru** — Kural tabanlı, AI/LLM bağımlılığı yok. Uyarı, bilgi ve başarı tiplerinde öneriler
- **Dashboard widget'ı** — Operasyonel Uyarılar ana panelde gösterilir, analytics sayfasına link
- **Sidebar navigasyon** — "Operasyonel Analiz" linki Analiz grubuna eklendi

### Yeni Dosyalar

- `src/lib/analytics/queries.ts` — Tüm analitik sorguları ve tipleri
- `src/app/app/analytics/page.tsx` — Analiz sunucu sayfası
- `src/components/app/analytics/health-score-card.tsx` — Sağlık skoru ve metrik kartları
- `src/components/app/analytics/delayed-jobs-table.tsx` — Geciken iş emirleri tablosu
- `src/components/app/analytics/technician-analytics.tsx` — Teknisyen analizi bölümü
- `src/components/app/analytics/customer-analytics.tsx` — Müşteri analizi bölümü
- `src/components/app/analytics/parts-analytics.tsx` — Parça analizi bölümü
- `src/components/app/analytics/revenue-analytics.tsx` — Gelir analizi bölümü
- `src/components/app/analytics/service-analytics.tsx` — Servis analizi bölümü
- `src/components/app/analytics/recommendations-list.tsx` — Öneri listesi
- `src/components/app/analytics/operational-alerts-widget.tsx` — Dashboard uyarı widget'ı

### Değişen Dosyalar

- `src/app/app/page.tsx` — Dashboard'a Operational Alerts widget eklendi
- `src/components/app/app-shell.tsx` — Sidebar'a "Operasyonel Analiz" linki eklendi (Activity ikonu)
- `package.json` — Versiyon 0.4.2'ye güncellendi

### Regresyon Güvenliği

- Tüm v0.4.1 rotaları çalışıyor
- Dashboard, iş emirleri, müşteriler, araçlar, kabuller, raporlar, kasa, parçalar, tedarikçiler etkilenmedi
- Hiçbir Docker dosyası eklenmedi
- Hiçbir AI/LLM bağımlılığı eklenmedi
- Hiçbir tahmin modeli eklenmedi
- Hiçbir veritabanı şema değişikliği yapılmadı
- Hiçbir yeni ortam değişkeni gerekli değil

---

### Reporting & Management Overview

- **Raporlar modülü** (`/app/reports`) — Sidebar'da "Raporlar" menüsü, "Yakında" rozeti kaldırıldı
- **İş Emri Raporu** (`/app/reports/orders`) — Toplam/açık/tamamlanan/iptal iş emirleri, tarih/teknisyen/durum/müşteri filtreleri, günlük ve aylık bar grafikleri, en yüksek tutarlı ve en uzun süren iş emirleri tabloları
- **Müşteri Raporu** (`/app/reports/customers`) — Toplam/yeni/tekrar eden müşteri KPI'ları, tarih filtresi, en çok harcayan ve en çok ziyaret eden müşteri tabloları
- **Tahsilat Raporu** (`/app/reports/collections`) — Toplam tahsilat/açık alacak/gecikmiş alacak KPI'ları, ödeme yöntemi dağılımı (nakit/kredi kartı/havale/diğer), tarih filtresi, günlük ve aylık tahsilat grafikleri
- **Parça Raporu** (`/app/reports/parts`) — Stok değeri/toplam parça/kritik stok/tükenen parça KPI'ları, en çok kullanılan parçalar, en düşük stoklu parçalar tabloları
- **Teknisyen Raporu** (`/app/reports/technicians`) — Toplam atanan/tamamlanan iş, ortalama tamamlama süresi, teknisyen performans tablosu
- **CSV dışa aktarma** — Her rapor sayfasında CSV indirme butonu (BOM destekli UTF-8)
- **Yazdır görünümü** — Her rapor sayfasında yazdır butonu (`window.print()`)
- **Dashboard widget'ları** — Aylık Ciro, Bu Ay İş Emri, Bu Ay Tahsilat (raporlar sayfasına linkli KPI kartları)
- **Güvenlik** — Tüm rapor sorguları workshop-scoped, mevcut veritabanı verisi kullanılır, yeni model eklenmedi

### Rapor Alt Sayfaları

- `/app/reports` — Rapor ana sayfa (alt menü yönlendirmesi)
- `/app/reports/orders` — İş Emri Raporu
- `/app/reports/customers` — Müşteri Raporu
- `/app/reports/collections` — Tahsilat Raporu
- `/app/reports/parts` — Parça Raporu
- `/app/reports/technicians` — Teknisyen Raporu

### Yeni Dosyalar

- `src/lib/reports/queries.ts` — Tüm rapor sorguları (workshop-scoped)
- `src/lib/reports/export.ts` — CSV dışa aktarma ve yazdır yardımcıları
- `src/components/app/reports/reports-layout.tsx` — Rapor alt menü navigasyonu
- `src/components/app/reports/report-utils.tsx` — Ortak rapor bileşenleri (StatCard, BarChart, ReportTable, ReportHeader)
- `src/components/app/reports/orders-report.tsx` — İş emri raporu istemci bileşeni
- `src/components/app/reports/customers-report.tsx` — Müşteri raporu istemci bileşeni
- `src/components/app/reports/collections-report.tsx` — Tahsilat raporu istemci bileşeni
- `src/components/app/reports/parts-report.tsx` — Parça raporu istemci bileşeni
- `src/components/app/reports/technicians-report.tsx` — Teknisyen raporu istemci bileşeni
- `src/components/app/dashboard/report-widgets.tsx` — Dashboard rapor widget'ları
- `src/app/app/reports/orders/page.tsx` — İş emri raporu sunucu sayfası
- `src/app/app/reports/customers/page.tsx` — Müşteri raporu sunucu sayfası
- `src/app/app/reports/collections/page.tsx` — Tahsilat raporu sunucu sayfası
- `src/app/app/reports/parts/page.tsx` — Parça raporu sunucu sayfası
- `src/app/app/reports/technicians/page.tsx` — Teknisyen raporu sunucu sayfası

### Değişen Dosyalar

- `src/app/app/page.tsx` — Dashboard'a 3 yeni widget eklendi (Aylık Ciro, Bu Ay İş Emri, Bu Ay Tahsilat)
- `src/app/app/reports/page.tsx` — ComingSoonShell yerine rapor alt menü navigasyonu
- `src/components/app/app-shell.tsx` — Raporlar "Yakında" rozeti kaldırıldı, COMING_SOON_PREFIXES boşaltıldı

### Regresyon Güvenliği

- Tüm v0.4.0 rotaları çalışıyor
- Dashboard, iş emirleri, müşteriler, araçlar, kabuller, kasa, parçalar, tedarikçiler, teklifler, randevular, hatırlatmalar etkilenmedi
- Hiçbir Docker dosyası eklenmedi
- Hiçbir AI/analitik özelliği eklenmedi
- Hiçbir tahmin/forecast modülü eklenmedi
- Hiçbir ödeme ağ geçidi eklenmedi
- Hiçbir fatura/e-arşiv modülü eklenmedi
- Hiçbir çok şubeli destek eklenmedi

---

### Technician Mobile Workspace

- **Teknisyen modeli**: Workshop-scoped Technician entity with roles (Usta, Teknisyen, Servis Danışmanı, Yönetici)
- **İş emri ataması**: Work orders can be assigned to technicians with `assignedTechnicianId`, `assignedAt`, `completedAt` fields
- **Teknisyen paneli** (`/app/technician`): Mobile-first dashboard with KPI cards, active/waiting/completed job sections
- **Teknisyen iş emri görünümü** (`/app/technician/orders/[id]`): Vehicle summary, customer info, complaint, checklist, photos, parts requests, labor tracking, internal notes
- **Kontrol listesi**: Inspection, repair, delivery checklists with per-item check/uncheck, notes, and progress bar
- **Onarım fotoğrafları**: Before/during/after repair photo phases linked to work orders and vehicle passport
- **İç notlar**: Workshop-only notes never exposed on public passport or customer outputs
- **Parça talep akışı**: Requested → Prepared → Delivered status flow for parts
- **İşçilik süre takibi**: Start/stop labor sessions with automatic duration calculation
- **Mobil UX**: Large touch targets, bottom sticky action bar, camera-first workflow
- **Araç pasaportu entegrasyonu**: Completed work, repair photos, and timeline events feed into Vehicle Service Passport
- **Yönetici panosu widget**: "Usta İş Durumu" showing per-technician active/delayed/completed job counts
- **Güvenlik**: Workshop-scoped queries, no cross-workshop access, internal notes never public
- **Seed data**: Demo technicians (Hasan Usta, Ali Teknisyen, Fatma Danışman)

---

## v0.3.5 Özellikler

### Digital Vehicle Service Passport

- **Araç servis pasaportu sayfası** (`/app/vehicles/[id]/passport`): Araç özeti, müşteri bilgisi, servis zaman çizelgesi, iş emri geçmişi, hasar geçmişi, fotoğraf geçmişi, bakım hatırlatmaları, hızlı istatistikler
- **Paylaşım & QR bölümü**: Pasaport token oluşturma, etkinleştirme/devre dışı bırakma, silme, etiket, son kullanma tarihi, görünürlük kontrolleri, link kopyalama, önizleme, QR kodu
- **Görünürlük kontrolleri**: 6 ayrı toggle — zaman çizelgesi, iş emirleri, hasarlar, fotoğraflar, hatırlatmalar, ödeme durumu
- **Public araç pasaportu** (`/p/[token]`): Müşteri-güvenli sayfa, iç notlar/OCR/ID gösterilmez, markalı BakimX düzeni
- **Yazdırılabilir pasaport** (`/p/[token]/pdf`): Print-optimized HTML
- **WhatsApp paylaşım metni**: Ön hazırlıklı Türkçe mesaj
- **QR kodu**: `qrcode.react` ile istemci tarafı SVG QR kodu üretimi
- **Data sanitization**: `sanitizePassportForPublic()` tüm iç verileri temizler
- **Güvenlik**: Workshop-scoped sorgular, tahmin edilemez token (nanoid 32), süresi dolmuş/devre dışı token'lar 404 döner
- **Audit log**: Tüm token oluşturma/güncelleme/silme işlemleri kaydedilir
- **Seed data**: Demo pasaport token (`demo-vehicle-passport-token-2024`)

### API Rotaları
- `POST /api/vehicles/[id]/passport` — Pasaport token oluştur
- `PATCH /api/vehicles/[id]/passport/[tokenId]` — Token güncelle (toggle, visibility)
- `DELETE /api/vehicles/[id]/passport/[tokenId]` — Token sil
- `GET /p/[token]` — Public pasaport sayfası (auth gerekmez)
- `GET /p/[token]/pdf` — Yazdırılabilir HTML (auth gerekmez)

---

## v0.3.4 Özellikler

### AI Service Advisor Lite

- **AI sağlayıcı yapılandırması:** `AI_PROVIDER` artık `mock` (varsayılan), `openai`, `deepseek` değerlerini destekler
- **`AI_MODEL` ortam değişkeni:** Sağlayıcıdan bağımsız model override. Varsayılanlar: gpt-4o-mini (OpenAI), deepseek-chat (DeepSeek)
- **Mock varsayılan:** `AI_PROVIDER` ayarlanmazsa veya `mock` ise anahtar kelime eşlemeli Türkçe demo önerileri döner
- **Servis danışmanı paneli:** İş emri detayında şikayet → kontrol, işçilik, parça önerileri, müşteri açıklaması, iç servis notu
- **Bağımsız danışman:** Yeni iş emri sayfasında serbest form girdi ile AI öneri alma
- **Kabul entegrasyonu:** Araç kabul detayında AI servis danışmanı paneli
- **Önceki iş emirleri context'i:** Aynı araca ait son 5 iş emri AI'ya bağlam olarak gönderilir
- **Kullanıcı onayı zorunlu:** AI önerileri otomatik eklenmez — İş Emrine Ekle / Yoksay / Düzenle ve ekle
- **Eksik bilgi uyarıları:** KM yoksa, marka/model yoksa otomatik uyarı
- **Güvenlik:** AI sonucu tavsiye niteliğindedir, kesin arıza teşhisi değildir. rawResponse public outputta görünmez
- **Audit log:** `ai_advisor_requested` aksiyonu ile workshop-scoped denetim izi
- **API rotaları:** `POST /api/orders/advisor` (iş emri kapsamlı), `POST /api/advisor` (bağımsız)

---

## v0.3.3 Özellikler

### Smart Capture Hardening & Real OCR Provider

- **OCR sağlayıcı yapılandırması:** `OCR_PROVIDER` artık `mock`, `deepseek`, `openai`, `tesseract` değerlerini destekler
- **`OCR_MODEL` ortam değişkeni:** Sağlayıcıdan bağımsız model override. `DEEPSEEK_OCR_MODEL` ve `OPENAI_OCR_MODEL` geriye dönük uyumlu
- **Mock varsayılan:** `OCR_PROVIDER` ayarlanmazsa veya `mock` ise sabit demo verisi döndürülür, API anahtarı gerekmez
- **Tesseract-only sağlayıcısı:** `OCR_PROVIDER=tesseract` ile API anahtarı olmadan yerel OCR mümkün; doğruluk düşük, fallback olarak önerilir
- **Eksik API anahtarı hatası:** Gerçek sağlayıcı seçildiğinde API anahtarı eksikse açık Türkçe hata mesajı
- **Görsel yükleme sıkılaştırma:** 8 MB boyut sınırı, MIME tipi doğrulama, HEIC dönüştürme sonrası boyut kontrolü
- **Multipart/form-data desteği:** OCR yükleme rotası artık `multipart/form-data` ile dosya yüklemeyi de destekler
- **rawText gizliliği:** OCR API yanıtlarından `rawText` alanı çıkarılır; yalnızca veritabanında saklanır
- **Güven oranı UX'i:** Düşük güven oranlı alanlar (%70 altı) sarı vurgu ile işaretlenir, yüzde gösterilir
- **OCR sağlayıcı etiketi:** Onay ekranında kullanılan sağlayıcı gösterilir (Demo, OpenAI Vision, Tesseract+DeepSeek, Tesseract Yerel)
- **VIN/plaka tekrar uyarısı:** Aynı VIN veya plaka ile mevcut araç varsa onay öncesi uyarı gösterilir
- **Vehicle unique constraint:** `Vehicle(workshopId, plate)` DB seviyesinde benzersiz; VIN için uygulama seviyesinde tekrar kontrolü
- **OCR audit log:** `ocr_capture` ve `ocr_confirmed` aksiyonları ile tam denetim izi
- **Tesseract yaşam döngüsü:** Worker singleton, kuyruk tabanlı tanıma, `terminateTesseractWorker()` temizleme fonksiyonu belgeli

---

## v0.3.1 Özellikler

### OCR & Smart Capture Foundation

- **OCR sağlayıcı mimarisi:** `lib/ocr/` altında soyut sağlayıcı, mock uygulama, factory
- **Ruhsat okuma akışı:** `/app/smart-capture/registration` — kamera/dosya yükleme, OCR, onay, kayıt
- **Mobil-öncelikli kamera:** `capture="environment"` ile doğrudan kamera erişimi
- **OCR sonucu onayı:** Tüm alanlar düzenlenebilir, kullanıcı onayı zorunlu
- **Kayıt ön doldurma:** Plaka/VIN ile mevcut araç arama, müşteri/araç otomatik oluşturma
- **Çift kayıt önleme:** Aynı plaka/VIN ile tekrar araç oluşturmaz
- **İş emri entegrasyonu:** "Ruhsattan Doldur" kısayolu, sidebar menü öğesi
- **OCR audit/log:** `OcrLog` modeli ile tam log kaydı (ham metin, çıkarılan JSON, onaylanan JSON)
- **KVKK uyumu:** OCR verisi workshop-scoped, ham metin public değil, onay zorunlu
- **Gerçek OCR varsayılan:** Tesseract metin okuma + DeepSeek JSON alan eşleme

---

## v0.2.2 Özellikler

### Teklifler Modülü (`/app/quotes`)

- **Teklif listesi:** Tüm teklifler tablo/kart görünümü, durum filtresi, arama
- **Yeni teklif:** Müşteri/araç seçimi, parça/işçilik kalemleri, otomatik toplam hesabı
- **Teklif detay:** Kalem listesi, toplam bilgisi, durum güncelleme
- **Tekliften iş emrine dönüştürme:** Tek tıkla kabul + iş emri oluşturma
- **TKF ön eki:** Quote numaralandırma

### Randevular Modülü (`/app/appointments`)

- **Randevu listesi:** Takvim/kart görünümü, durum filtresi, arama
- **Yeni randevu:** Müşteri/araç seçimi, tarih/saat seçimi, notlar
- **Randevu detay:** Randevu bilgisi, müşteri/araç özeti, durum güncelleme
- **Randevudan iş emrine dönüştürme:** Randevu tarihinde tek tıkla kabul + iş emri
- **RND ön eki:** Randevu numaralandırma

### Dashboard Entegrasyonu

- **Bugünkü Randevular widget'ı:** Dashboard'da bugünün randevularını gösterir
- **Hızlı İşlemler:** "Yeni Teklif" ve "Yeni Randevu" butonları
- **Header:** "Yeni Teklif" ve "Yeni Randevu" CTA butonları
- **Sidebar:** Teklifler ve Randevular aktif bağlantılar (artık "Yakında" rozeti yok)

### Status Badges

- `AppointmentStatusBadge` — Randevu durum rozeti
- `QuoteStatusBadge` — Teklif durum rozeti

### Tenant İzolasyonu

- Tüm teklif ve randevu sorguları `workshopId` ile kapsamlı
- Müşteri/araç seçici yalnızca workshop verisini gösterir
- Dönüştürme işlemleri workshop-scoped

### Placeholder Özellikler

- Gerçek SMS/WhatsApp hatırlatma gönderimi yok (sadece log)
- E-posta hatırlatma, takvim senkronizasyonu, yinelenen randevu yok
- Teklif şablonu / kopyalama yok
- Stok düşümü yok (tekliften iş emrine geçerken parça rezervasyonu yapılmaz)

### Regresyon Güvenliği

- Tüm v0.2.1 rotaları çalışıyor
- Dashboard, iş emirleri, müşteriler, araçlar, kabuller etkilenmedi
- Public output, PDF, fotoğraf/storage, mock SMS etkilenmedi
- Hiçbir Docker dosyası eklenmedi

---

## v0.2.1 Özellikler

### Araç Listesi UX Yenileme (`/app/vehicles`)

- Profesyonel masaüstü tablosu (8 sütun) + mobil kart görünümü
- Arama: plaka, marka, model, müşteri adı, telefon
- Araç tipi filtresi (Binek, Hafif Ticari, Ağır Vasıta, Motosiklet, Diğer)
- Marka filtresi (mevcut veriden otomatik derlenir)
- PlateBadge tutarlı stil
- Boş durumlar için Türkçe mesajlar
- "Plaka Tara" placeholder (plaka tanıma entegrasyonu yakında)

### Yeni Araç Sayfası (`/app/vehicles/new`)

- İki sütunlu yerleşim: form + ipucu paneli
- Bölümlere ayrılmış form: Müşteri Bağlantısı, Araç Bilgileri, Teknik Bilgiler, Notlar
- "Ruhsattan Oku" placeholder (OCR yakında)
- Mobil sticky alt aksiyon çubuğu
- Türkçe validasyon mesajları

### Araç Detay Sayfası (`/app/vehicles/[id]`)

- Araç Özeti, Müşteri Bilgisi, İş Emri Geçmişi, Kabul Geçmişi
- Hasar Geçmişi (tüm kabullerden toplu), Fotoğraf Geçmişi (thumbnail grid)
- Araç Durumu yan paneli (işlem, onay, hasar, fotoğraf durumu)
- Mobil uyumlu tek sütun yerleşim

### Araç Düzenleme (`/app/vehicles/[id]/edit`)

- Yeni araç formu ile aynı alanlar, ön doldurmalı
- Tenant sahiplik kontrolü

### Şema Genişletmeleri (Geriye Dönük Uyumlu)

- `Vehicle.color`, `Vehicle.engineNo`, `Vehicle.fuelType`, `Vehicle.transmission`, `Vehicle.notes`
- `vehicleUpdateSchema` Zod validasyonu
- `VEHICLE_TYPES`, `VEHICLE_FUEL_TYPES`, `VEHICLE_TRANSMISSIONS` sabitleri

### Yeni Bileşenler

- `PlateBadge` (`src/components/app/plate-badge.tsx`) — tutarlı plaka rozeti
- `VehicleList` — liste + filtre + tablo/kart
- `VehicleDetail` — detay sayfası bileşeni

### Placeholder Özellikler

- "Plaka Tara" butonu yalnızca UI placeholder
- "Ruhsattan Oku" butonu yalnızca UI placeholder

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
- `/app/reminders`
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
- `/p/[token]` — Dijital araç servis pasaportu (public, token tabanlı)
- `/p/[token]/pdf` — Yazdırılabilir pasaport sayfası

### Auth
- `/login` — Giriş
- Genel kayıt (register) akışı yoktur; hesaplar seed/yönetici ile sağlanır. `/register` `/login`'e yönlenir.

### Panel (`/app/*`)
- `/app` — Genel Bakış (dashboard)
- `/app/workshop` — İş yeri profili
- `/app/customers` — Müşteri listesi (arama destekli)
- `/app/customers/new` — Yeni müşteri
- `/app/customers/[id]` — Müşteri detayı
- `/app/vehicles` — Araç listesi (arama, tip/marka filtresi, desktop tablo, mobil kart)
- `/app/vehicles/new` — Yeni araç (gelişmiş form, teknik bilgiler, ruhsat okuma linki)
- `/app/vehicles/[id]` — Araç detayı (özet, müşteri, iş emri/kabul/hasar/fotoğraf geçmişi)
- `/app/vehicles/[id]/edit` — Araç düzenle
- `/app/vehicles/[id]/passport` — Dijital servis pasaportu (paylaşım, QR, geçmiş)
- `/app/smart-capture/registration` — Ruhsat okuma (kamera/dosya yükleme, OCR, onay)
- `/app/intakes` — Kabul listesi (durum filtreli)
- `/app/intakes/new` — Yeni kabul sihirbazı
- `/app/intakes/[id]` — Kabul detayı (sekmeli, fotoğraf galerili)
- `/app/orders` — İş emri listesi (KPI'lar, filtreler, masaüstü tablosu, mobil kartları)
- `/app/orders/new` — Yeni iş emri (kabul seçici)
- `/app/orders/[id]` — İş emri detayı (sticky fiyat paneli, durum/ödeme)
- `/app/quotes` — Teklifler (arama, durum filtresi, tablo/kart)
- `/app/appointments` — Randevular (arama, durum filtresi, takvim/kart)
- `/app/calendar` — Takvim (günlük/haftalık/ayılk görünüm, randevu+teslimat+bakım)
- `/app/reminders` — Bakım Hatırlatmaları (liste, oluşturma, detay, düzenleme, durum)
- `/app/inventory` — Stok / Parçalar (Yakında)
- `/app/suppliers` — Tedarikçiler (liste, oluşturma, detay, düzenleme)
- `/app/suppliers/new` — Yeni tedarikçi
- `/app/suppliers/[id]` — Tedarikçi detayı
- `/app/suppliers/[id]/edit` — Tedarikçi düzenle
- `/app/cash` — Kasa (Yakında)
- `/app/reports` — Raporlar (alt menü ile 5 rapor türü)
- `/app/analytics` — Operasyonel Analiz
- `/app/communications` — İletişim Kayıtları (SMS, WhatsApp, e-posta logları)
- `/app/settings/notifications` — Bildirim Ayarları (şablon yönetimi)
- `/app/settings/calendar` — Takvim Ayarları (sağlayıcı yapılandırması)

### API
- `POST /api/smart-capture/ocr` — OCR çalıştır (JSON body veya multipart/form-data), sonucu ve ocrLogId döndür (rawText hariç)
- `POST /api/smart-capture/confirm` — Onaylanan alanları kaydet, müşteri/araç oluştur
- `GET /api/vehicles` — Araç listesi (opsiyonel ?customerId=)
- `POST /api/vehicles` — Araç oluştur
- `GET /api/vehicles/[id]` — Tek araç getir
- `PUT /api/vehicles/[id]` — Araç güncelle
- `DELETE /api/vehicles/[id]` — Araç sil (bağlı kayıt varsa güvenli hata)
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
- `POST /api/orders/advisor` — AI servis danışmanı (iş emri kapsamlı, intakeFormId zorunlu)
- `POST /api/advisor` — AI servis danışmanı (bağımsız, complaint zorunlu)
- `POST /api/communications/templates` — Bildirim şablonu kaydet
- `DELETE /api/communications/templates` — Bildirim şablonu sıfırla
- `GET /api/communications/logs` — İletişim kayıtlarını getir
- `POST /api/communications/preferences` — Müşteri iletişim tercihlerini güncelle
- `GET/POST /api/cron/reminders` — Zamanlanmış hatırlatma işleri (CRON_SECRET ile korumalı)

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

## Sınırlamalar (v0.5.0)
- Gerçek SMS gönderimi için Netgsm API anahtarı gerekir (mock varsayılan)
- Gerçek WhatsApp gönderimi için WhatsApp Business API gerekir (mock varsayılan, template message API henüz yok)
- Gerçek e-posta gönderimi için Resend API anahtarı gerekir (mock varsayılan)
- Randevu hatırlatma zamanlaması (24h/1h öncesi) için cron job gerekir
- Rate limiting bellek içi (dağıtık ortamda Redis gerekir)
- **Login rate-limit'i istemci IP'sine dayanır — ters proxy (nginx) yapılandırması zorunludur.** Login ve cron gibi uç noktalar istemci IP'sini `X-Forwarded-For` başlığından okur. nginx (veya kullanılan ters proxy) gerçek istemci IP'sini bu başlığa yazmalıdır; aksi halde (a) tüm istekler tek `"unknown"` kovasında toplanır ve yanlışlıkla toplu kilitlenme/DoS oluşabilir, (b) başlık istemci tarafından taklit edilerek limit aşılabilir. Önerilen nginx yapılandırması:
  ```nginx
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $remote_addr;   # istemci IP'sini üzerine yaz (zincire ekleme)
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```
- OCR için üretim ortamında ilgili sağlayıcının API anahtarı gerekir (mock harici)
- Tesseract-only sağlayıcısının doğruluğu DeepSeek/OpenAI'dan düşüktür
- AI Servis Danışmanı mock sağlayıcısı basit anahtar kelime eşlemesi kullanır (LLM gibi bağlamsal değil)
- AI danışman üretim ortamında ilgili sağlayıcının API anahtarı gerekir (mock harici)
- AI sonucu tavsiye niteliğindedir, kesin arıza teşhisi değildir
- rawResponse yalnızca geliştirme modunda sunucu loglarında görünür, API yanıtında yer almaz
- Gerçek sesle doldurma / barkod tarama yok (placeholder)
- "Excel İçe Aktar" yalnızca UI placeholder
- @react-pdf/renderer sunucu PDF üretimi henüz aktif değil (print-optimized HTML mevcut)
- S3 depolama sağlayıcısı henüz uygulanmadı (placeholder)
- İstemci tarafı görüntü sıkıştırma henüz uygulanmadı
- Ödeme / tahsilat modülü sadece etiket (Bakiye Özeti temel düzeydedir)
- E-fatura / e-arşiv / fatura modülü yok
- Çok şubeli kurumsal modül yok
- Tedarikçi API entegrasyonu yok
- Satın alma / teklip modülü yok ("Yakında" placeholder)
- Kasa modülü aktif (tahsilat listesi, ödeme, bakiye özeti)
- Raporlar modülü aktif (5 rapor türü, CSV dışa aktarma, yazdır görünümü)
- Operasyonel Analiz modülü aktif (kural tabanlı öneri motoru, AI/LLM bağımlılığı yok)
- İletişim modülü aktif (SMS, WhatsApp, e-posta; mock ve gerçek sağlayıcılar)
- Takvim senkronizasyonu: Google Calendar çıkış (outbound) destekli, gelişmiş OAuth akışı yok
- Yinelenen randevu (recurring appointment) yok
- Teklif şablonu / kopyalama yok
- Stok düşümü yok (tekliften iş emrine geçerken parça rezervasyonu yapılmaz)
- Docker konteyner desteği yok (lokal bun/npm)
- Pasaport token'ları için gerçek QR indirme butonu yok (görüntü olarak gösterilir)

---

## Sürümler

- [v0.5.1](docs/releases/v0.5.1.md) — Calendar & Reminder Automation (güncel)
- [v0.5.0](docs/releases/v0.5.0.md) — Real Communication Integrations
- [v0.4.2](docs/releases/v0.4.2.md) — Operational Analytics
- [v0.4.1](docs/releases/v0.4.1.md) — Reporting & Management Overview
- [v0.4.0](docs/releases/v0.4.0.md) — Technician Mobile Workspace
- [v0.3.5](docs/releases/v0.3.5.md) — Digital Vehicle Service Passport
- [v0.3.4](docs/releases/v0.3.4.md) — AI Service Advisor Lite
- [v0.3.3](docs/releases/v0.3.3.md) — Smart Capture Hardening & Real OCR Provider
- [v0.3.1](docs/releases/v0.3.1.md) — OCR & Smart Capture Foundation
- [v0.3.0](docs/releases/v0.3.0.md) — Kasa & Tahsilat Foundation
- [v0.2.2](docs/releases/v0.2.2.md) — Teklifler & Randevular Foundation
- [v0.2.1](docs/releases/v0.2.1.md) — Araçlar Modülü UX Alignment
- [v0.2.0](docs/releases/v0.2.0.md) — Dashboard & Operations Overview
- [v0.1.5](docs/releases/v0.1.5.md) — Müşteri Yönetimi UX Alignment
- [v0.1.4](docs/releases/v0.1.4.md) — İş Emri UX Alignment
- [v0.1.3](docs/releases/v0.1.3.md) — Image Storage & Intake Media Foundation
- [v0.1.2](docs/releases/v0.1.2.md) — Public Output & PDF Foundation
- [v0.1.1](docs/releases/v0.1.1.md) — Hardening & UX Polish
- [v0.1.0](docs/releases/v0.1.0.md) — MVP
- [v0.0.1](docs/releases/v0.0.1.md) — Başlangıç

## QA

- [v0.5.1 Manuel QA](docs/QA/v0.5.1-manual-checklist.md)
- [v0.5.0 Manuel QA](docs/QA/v0.5.0-manual-checklist.md)
- [v0.4.2 Manuel QA](docs/QA/v0.4.2-manual-checklist.md)
- [v0.4.1 Manuel QA](docs/QA/v0.4.1-manual-checklist.md)
- [v0.3.5 Manuel QA](docs/QA/v0.3.5-manual-checklist.md)
- [v0.3.4 Manuel QA](docs/QA/v0.3.4-manual-checklist.md)
- [v0.3.3 Manuel QA](docs/QA/v0.3.3-manual-checklist.md)
- [v0.3.1 Manuel QA](docs/QA/v0.3.1-manual-checklist.md)
- [v0.3.0 Manuel QA](docs/QA/v0.3.0-manual-checklist.md)
- [v0.2.5 Manuel QA](docs/QA/v0.2.5-manual-checklist.md)
- [v0.2.2 Manuel QA](docs/QA/v0.2.2-manual-checklist.md)
- [v0.2.1 Manuel QA](docs/QA/v0.2.1-manual-checklist.md)
- [v0.2.0 Manuel QA](docs/QA/v0.2.0-manual-checklist.md)
- [v0.1.5 Manuel QA](docs/QA/v0.1.5-manual-checklist.md)
- [v0.1.4 Manuel QA](docs/QA/v0.1.4-manual-checklist.md)
- [v0.1.3 Manuel QA](docs/QA/v0.1.3-manual-checklist.md)
- [v0.1.2 Manuel QA](docs/QA/v0.1.2-manual-checklist.md)
- [v0.1.1 Manuel QA](docs/QA/v0.1.1-manual-checklist.md)
- [v0.1.1 Tenant İzolasyonu QA](docs/QA/v0.1.1-tenant-isolation-checklist.md)
