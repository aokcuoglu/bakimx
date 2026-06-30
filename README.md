# BakımX

**Oto servisler için mobil-öncelikli, bulut tabanlı servis yönetim platformu (SaaS).**

Müşteri kabulünden iş emri, teklif/onay, fotoğraf & hasar dokümantasyonu, tahsilat, stok ve bakım hatırlatmalarına kadar bir özel servisin günlük operasyonunu tek yerden yönetir. Çoklu işletme (multi-tenant), rol bazlı erişim ve müşteriye açık şeffaf servis paylaşımı içerir.

> Durum: **v0.5.x** — üretime sertleştirilen beta. Sürüm geçmişi: [CHANGELOG.md](./CHANGELOG.md)

---

## Öne çıkan özellikler

- **İş emri yaşam döngüsü** — kabul → teklif → onay → işlemde → teslim, durum geçiş kontrolleriyle.
- **OTP'li müşteri onayı & teslim** — teklif ve teslim adımları müşteri OTP'siyle doğrulanır (manuel atlama engelli).
- **Fotoğraf & hasar dokümantasyonu** — kamera ile çekim, görsel üzerine kalemle işaretleme (PhotoAnnotate).
- **Ruhsat & plaka OCR** — kendi sunucumuzda barındırılan OpenCV/Tesseract ile akıllı yakalama.
- **Teklif & sipariş** — kalem bazlı işçilik/parça, KDV, iskonto, kuruş tutarlı toplamlar.
- **Tahsilat & cari** — ödeme takibi, yaşlandırma (aging), tahsilat raporları.
- **Stok & tedarikçi**, **randevu & takvim senkron**, **bakım hatırlatmaları (SMS/WhatsApp/e-posta)**.
- **Müşteriye açık servis paylaşımı** — public link + PDF, alan-bazlı gizlilik kontrolleri.
- **Araç servis pasaportu** — araca yapışan dijital geçmiş.
- **Admin back-office** — işletme onayı, billing, impersonation, işletme bazlı feature flag, denetim/health.
- **Abonelik/billing** — public fiyatlandırma, in-app checkout, dönem yönetimi, makbuz.

Modül ve mimari diyagramları: [docs/architecture](./docs/architecture/).

---

## Teknoloji yığını

- **Framework:** Next.js 16 (App Router) · React 19
- **Dil:** TypeScript (strict)
- **UI:** Tailwind CSS v4 · shadcn/ui (base-nova, @base-ui/react) · Framer Motion · lucide-react
- **ORM / DB:** Prisma 7 · PostgreSQL (pg adapter)
- **Auth:** iron-session + bcryptjs
- **Validasyon:** Zod v4
- **Depolama:** S3-uyumlu — MinIO (yerel) / Cloudflare R2 (prod)
- **OCR:** Tesseract + OpenCV (self-hosted) · DeepSeek/OpenAI vision (opsiyonel)
- **AI Danışman:** Mock / OpenAI / DeepSeek (Premium'a gated)
- **Paket yöneticisi:** Bun
- **Altyapı:** Docker (yalnızca VPS/prod) · Contabo VPS · GitHub Actions

---

## Hızlı başlangıç

> Yerel geliştirmede Docker yalnızca PostgreSQL + MinIO altyapısı için kullanılır; uygulama host'ta çalışır.

```bash
# 1) Klonla ve bağımlılıkları kur
git clone https://github.com/aokcuoglu/bakimx.git && cd bakimx
bun install

# 2) Yerel altyapıyı başlat (PostgreSQL + MinIO)
docker compose -f docker-compose.local.yml up -d

# 3) Ortamı hazırla
cp .env.example .env.local   # değerleri docs/CONFIGURATION.md'ye göre düzenle

# 4) Veritabanı (migration + demo veri)
bun run db:migrate
bun run db:seed

# 5) Geliştirme sunucusu
bun run dev   # http://localhost:3000
```

Demo giriş bilgileri, tüm ortam değişkenleri (OCR, AI, SMS/WhatsApp/e-posta, cron, takvim, depolama) ve yerel altyapı komutları için **[docs/CONFIGURATION.md](./docs/CONFIGURATION.md)**.

### Sık kullanılan komutlar
```bash
bun run dev          # geliştirme
bun run build        # üretim derlemesi
bun run lint         # eslint
bun run typecheck    # tsc --noEmit
bun run db:studio    # Prisma Studio
bun run db:seed      # demo veri
bun run release      # sürüm damgalama
```

---

## Proje yapısı

```
src/app/(app)      Korumalı uygulama (intake, orders, quotes, cashbox, inventory, reports, ...)
src/app/(auth)     Giriş / şifremi unuttum
src/app/admin      Back-office (workshops, billing, flags, audit, health, leads)
src/app/api        API rotaları (auth, cron, billing, advisor, ...)
src/components      UI bileşenleri (app, billing, auth, ...)
src/lib             Domain mantığı (auth, status-transitions, intake, passport, rate-limit, ...)
prisma              schema.prisma · migrations · seed
docs                Dokümantasyon (bkz. docs/README.md)
scripts             Operasyon/dağıtım/OCR yardımcı scriptleri
```

---

## Dokümantasyon

| Konu | Doküman |
|---|---|
| Yapılandırma & env | [docs/CONFIGURATION.md](./docs/CONFIGURATION.md) |
| Veritabanı şeması | [DB.md](./DB.md) |
| Dağıtım (prod) | [DEPLOY.md](./DEPLOY.md) |
| Staging kurulumu | [docs/STAGING-SETUP.md](./docs/STAGING-SETUP.md) |
| Sürüm süreci | [RELEASE.md](./RELEASE.md) |
| Mimari | [docs/architecture/BAKIMX-ARCHITECTURE.md](./docs/architecture/BAKIMX-ARCHITECTURE.md) |
| Sürüm notları | [CHANGELOG.md](./CHANGELOG.md) · [docs/releases/](./docs/releases/) |
| Katkı rehberi | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Güvenlik | [SECURITY.md](./SECURITY.md) |

---

## Geliştirme akışı

`feature/*` → `dev` → **staging** (otomatik) → doğrulama → `dev→main` PR → tag `vX.Y.Z` → **prod**

Detaylar: [RELEASE.md](./RELEASE.md) · [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Lisans

Özel ve tescilli (proprietary). Tüm hakları saklıdır © BakımX.
