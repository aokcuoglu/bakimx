# BakımX — Yapılandırma ve Ortam Değişkenleri

> Bu doküman README'den ayrıştırılmıştır. Kanonik kaynak `.env.example`'dır; aşağıdaki açıklamalar onu tamamlar.

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

#### Satış Saha Ağı — Google Maps ve Places

```env
GOOGLE_MAPS_BROWSER_API_KEY=browser-key
GOOGLE_MAPS_MAP_ID=map-id
# Yalnız ileride sunucu taraflı çağrı eklenirse:
# GOOGLE_MAPS_SERVER_API_KEY=server-key
```

- `GOOGLE_MAPS_BROWSER_API_KEY`, Google Cloud'da yalnız **Maps JavaScript API**
  ve **Places API (New)** için yetkili olmalı; `localhost` ile kullanılan BakımX
  origin'lerine HTTP referrer kısıtı uygulanmalıdır.
- Tarayıcı anahtarı gizli değildir. `NEXT_PUBLIC_*` yerine server page üzerinden
  runtime'da aktarılır; böylece aynı ECS imajı ortamlar arasında taşınırken build
  zamanında donmaz.
- Advanced Markers için ortama ait `GOOGLE_MAPS_MAP_ID` zorunludur.
- İki değer de eksikse `/admin/sales` içindeki portföy ve görev akışları çalışır;
  harita, açık bir yapılandırma bekleme durumu gösterir.
- Sunucu taraflı Places/Geocoding ihtiyacı doğarsa browser anahtarı yeniden
  kullanılmaz. Ayrı `GOOGLE_MAPS_SERVER_API_KEY`, sunucu çıkış IP'leri ve gereken
  API'lerle kısıtlanır; istemci bileşenlerine geçirilmez.
- Google Places sonuçları topluca CRM'e aktarılmaz. Danışman haritada bir işletme
  seçip açıkça satış fırsatı oluşturur; kalıcı harici kimlik olarak `placeId`
  kullanılır.

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

# MVP önerisi: Claude Vision — app içinde, sidecar yok
# OCR_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...
# OCR_MODEL=claude-sonnet-5   # varsayılan; ucuz/hızlı için claude-haiku-4-5

# Alternatif sağlayıcı
# OCR_PROVIDER=openai    # OPENAI_API_KEY + OCR_MODEL=gpt-4o
```

> `paddle` ve `hybrid` sağlayıcıları 2026-07'de, dayandıkları PaddleOCR Python
> sidecar'ı (`ocr-service/`) ile birlikte emekli edildi. Bu değerlerden birine
> ayarlı bir ortam kalmışsa uygulama açık bir hata ile durur.

**OCR davranışı:**
- `OCR_PROVIDER` ayarlanmazsa veya `mock` ise: sabit demo verisi döndürülür, API anahtarı gerekmez
- `OCR_PROVIDER=anthropic` (MVP): Claude Vision ile doğrudan görüntüden yapılandırılmış çıkarım; `ANTHROPIC_API_KEY` zorunlu, `OCR_MODEL` varsayılanı `claude-sonnet-5`
- `OCR_PROVIDER=openai`: OpenAI vision OCR; `OPENAI_API_KEY` zorunlu, `OPENAI_OCR_MODEL` veya `OCR_MODEL` zorunlu
- `OCR_MODEL` ortam değişkeni, sağlayıcıya özel model ayarını override eder
- Eksik API anahtarı durumunda açık Türkçe hata mesajı gösterilir; sahte veri üretilmez
- HEIC/HEIF dosyaları sunucuda JPEG'e dönüştürülerek okunur
- Maksimum görsel boyutu 8 MB; desteklenen MIME tipleri: JPEG, PNG, WebP, HEIC, HEIF
- Hem JSON body (data URL) hem de multipart/form-data yükleme desteklenir
- Kullanıcı onayı zorunludur — OCR sonucu otomatik kaydedilmez
- Düşük güven oranlı alanlar sarı vurgu ile işaretlenir

### Landing Ürün Asistanı Ortam Değişkenleri

```env
# Varsayılan: hazırlanan ve kaynaklı yanıt eşleştiricisi; dış çağrı yapmaz
LANDING_ASSISTANT_AI=off
AI_PROVIDER=mock

# Gerçek AI için: openai veya anthropic
# AI_PROVIDER=openai
# AI_PROVIDER=anthropic

# Sağlayıcıdan bağımsız model override (opsiyonel)
# AI_MODEL=gpt-4o-mini

# OpenAI (AI_PROVIDER=openai iken gerekli)
# OPENAI_API_KEY=your-key (OCR ile paylaşımlı)
# AI_MODEL=gpt-4o-mini

# Anthropic (AI_PROVIDER=anthropic iken gerekli)
# ANTHROPIC_API_KEY=your-key (OCR ile paylaşımlı)
# AI_MODEL=claude-haiku-4-5
```

**Landing asistanı davranışı:**
- `LANDING_ASSISTANT_AI=off` iken ziyaretçiye yalnız hazırlanmış, kaynaklı yanıtlar sunulur ve sunucu AI çağrısı yapmaz
- `AI_PROVIDER` ayarlanmazsa veya `mock` ise kaynaklı yerel eşleştirici kullanılır, API anahtarı gerekmez
- `AI_PROVIDER=openai`: OpenAI Chat Completions API; `OPENAI_API_KEY` zorunlu, `AI_MODEL` opsiyonel (varsayılan: gpt-4o-mini)
- `AI_PROVIDER=anthropic`: Anthropic Messages API; `ANTHROPIC_API_KEY` zorunlu, `AI_MODEL` opsiyonel (varsayılan: claude-haiku-4-5)
- `AI_MODEL` ortam değişkeni, sağlayıcıya özel model ayarını override eder

### Web Push (Teknisyen Bildirimleri) Ortam Değişkenleri

```env
# BAK-129 (Faz B). İkisi de BOŞ ise Web Push sessizce devre dışıdır —
# uygulama-içi bildirim (Faz A) çalışmaya devam eder, hiçbir şey kırılmaz.
# VAPID_PUBLIC_KEY=BM...   (base64url, ~87 karakter)
# VAPID_PRIVATE_KEY=...    (base64url, ~43 karakter — GİZLİ)

# RFC 8292 `sub` alanı; opsiyonel, varsayılan mailto:destek@bakimx.com
# VAPID_SUBJECT=mailto:destek@bakimx.com
```

Anahtar çifti bir kez üretilir ve **ortam başına sabit kalır** — değiştirilirse
mevcut tüm abonelikler geçersiz olur ve kullanıcıların bildirimleri yeniden
açması gerekir:

```sh
bun run push:vapid-keys
```

Üretimde anahtarlar SSM Parameter Store'a yazılır (diğer sağlayıcı env'leriyle
aynı konvansiyon, `/bakimx/<env>/<VAR>`); özel anahtar `SecureString` olmalıdır:

```sh
aws ssm put-parameter --name /bakimx/prod/VAPID_PUBLIC_KEY  --type String       --value "BM..." --overwrite
aws ssm put-parameter --name /bakimx/prod/VAPID_PRIVATE_KEY --type SecureString --value "..."    --overwrite
```

**Neden `NEXT_PUBLIC_*` değil:** açık anahtar da runtime'da SSM'den gelir, build
sırasında gömülemez. İstemci onu `GET /api/technician/push` ucundan alır.

**Web Push davranışı:**
- Anahtarlar yoksa `dispatchTechnicianPush` tek bir DB sorgusu bile yapmadan çıkar
- Olay kaynağı Faz A ile aynı (`AuditLog` → `isTechnicianNotifiableAction`); ayrı bir bildirim listesi yoktur
- Gönderim yalnız iş emrine atanmış teknisyenin **kendi atölyesindeki** hesabına gider; işlemi yapan kişiye kendi işleminin bildirimi gitmez
- Push servisi `404`/`410` dönerse abonelik satırı otomatik silinir
- iOS'ta yalnız "Ana Ekrana Ekle" ile kurulmuş PWA'da çalışır (iOS 16.4+); Safari sekmesinde arayüz bunu açıkça yazar

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
- `OPENAI_API_KEY` ve `ANTHROPIC_API_KEY` OCR sağlayıcısı ile paylaşılabilir

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
