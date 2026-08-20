# BakımX

**Oto servisler için mobil-öncelikli, bulut tabanlı servis yönetim platformu (SaaS).**

Müşteri kabulünden iş emri, teklif/onay, fotoğraf & hasar dokümantasyonu, tahsilat, stok ve bakım hatırlatmalarına kadar bir özel servisin günlük operasyonunu tek yerden yönetir. Çoklu işletme (multi-tenant), rol bazlı erişim ve müşteriye açık şeffaf servis paylaşımı içerir.

> Durum: **v0.7.x** — üretimde (canlı) beta. Sürüm geçmişi: [CHANGELOG.md](./CHANGELOG.md) · [Releases](https://github.com/aokcuoglu/bakimx/releases)

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
- **UI:** Tailwind CSS v4 · shadcn/ui (radix-nova; `radix-ui` + `@base-ui/react` geçiş halinde) · Framer Motion · lucide-react
- **ORM / DB:** Prisma 7 · PostgreSQL (pg adapter)
- **Auth:** iron-session + bcryptjs
- **Validasyon:** Zod v4
- **Depolama:** S3-uyumlu — MinIO (yerel) / Cloudflare R2 (prod)
- **OCR:** Plaka — Tesseract + OpenCV (self-hosted) · Ruhsat — Claude Vision (Sonnet 5)
- **AI Danışman:** Claude (Anthropic) — Premium'a gated
- **Paket yöneticisi:** Bun
- **Altyapı:** AWS (ECS/ECR, CDK) · Docker (prod imajı) · GitHub Actions (CI/CD)

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
cp .env.example .env.local   # değerleri docs/configuration.md'ye göre düzenle

# 4) Veritabanı (migration + demo veri)
bun run db:migrate
bun run db:seed

# 5) Geliştirme sunucusu
bun run dev   # http://localhost:3000
```

Demo giriş bilgileri, tüm ortam değişkenleri (OCR, AI, SMS/WhatsApp/e-posta, cron, takvim, depolama) ve yerel altyapı komutları için **[docs/configuration.md](./docs/configuration.md)**.

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
src/components     UI bileşenleri — aşağıya bak
src/lib            Domain mantığı (auth, status-transitions, intake, passport, rate-limit, ...)
src/hooks          Paylaşılan React hook'ları
src/middleware.ts  Kimlik/rota koruması
prisma             schema.prisma · migrations · seed
docs               Dokümantasyon (bkz. docs/README.md)
scripts            Veritabanı ve operasyon yardımcı scriptleri
```

`src/components` domaine göre bölünmüştür — `src/lib`'deki domain klasörleriyle
aynı adları kullanır, böylece bir özelliğin UI'ı ve mantığı yan yana bulunur:

```
ui/            shadcn/Base UI primitifleri — domain mantığı İÇERMEZ
layout/        uygulama kabuğu (app-shell, global arama, impersonation banner)
shared/        3+ domainde kullanılan jenerik parçalar (status-badge, actions-menu, forms/)

orders/  intake/  customers/  vehicles/  parts/  suppliers/  purchases/
cashbox/  quotes/  reminders/  appointments/  technician/  settings/
dashboard/  reports/  analytics/  communications/  advisor/  billing/

auth/  sections/ (landing)  site-assistant/  legal/
```

**Kural:** bir bileşen tek bir domain tarafından kullanılıyorsa o domainin
klasöründe durur; üç veya daha fazla domain kullanıyorsa `shared/`'a taşınır.

---

## Dokümantasyon

| Konu | Doküman |
|---|---|
| Tüm dokümantasyon | [docs/README.md](./docs/README.md) |
| Yapılandırma & env | [docs/configuration.md](./docs/configuration.md) |
| Veritabanı & migration | [docs/database.md](./docs/database.md) |
| Dallanma, deploy & sürüm | [docs/releasing.md](./docs/releasing.md) |
| AWS altyapı (prod/dev) | [docs/deployment/](./docs/deployment/) |
| Mimari | [docs/architecture/overview.md](./docs/architecture/overview.md) |
| Sürüm notları | [CHANGELOG.md](./CHANGELOG.md) · [docs/releases/](./docs/releases/) |
| Katkı rehberi | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Güvenlik | [SECURITY.md](./SECURITY.md) |

---

## Geliştirme akışı

`feature/*` → `dev` → **app-dev.bakimx.com** (AWS, otomatik) → doğrulama → `dev→main` PR → **prod** (AWS · app.bakimx.com)

Detaylar: [docs/releasing.md](./docs/releasing.md) · [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Lisans

Özel ve tescilli (proprietary). Tüm hakları saklıdır © 2026 BakımX. Bkz. [LICENSE](./LICENSE).
