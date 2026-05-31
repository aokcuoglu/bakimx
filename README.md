# BakimX

Oto servisler için dijital araç kabul, hasar kaydı, müşteri onayı ve iş emri platformu.

**Versiyon:** v0.1.0

## Hızlı Başlangıç

### Gereksinimler
- Node.js 18+ veya Bun
- PostgreSQL veritabanı

### Kurulum

```bash
# Repoyu klonlayın
git clone <repo-url>
cd bakimx

# Bağımlılıkları yükleyin
bun install
# veya
npm install

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

### Ortam Değişkenleri

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bakimx"
SESSION_SECRET="rastgele-32-karakter"
APP_URL="http://localhost:3000"
```

### Docker

Bu sürümde Docker kullanılmamaktadır. Local geliştirme bun/npm ile yapılır.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Dil:** TypeScript
- **CSS:** Tailwind CSS v4
- **UI:** shadcn/ui (base-nova, @base-ui/react)
- **ORM:** Prisma
- **Veritabanı:** PostgreSQL
- **Auth:** iron-session + bcryptjs
- **Validasyon:** Zod
- **Animasyon:** Framer Motion
- **İkon:** lucide-react

## v0.1.0 Özellikler
- Kullanıcı giriş/kayıt
- İş yeri profili yönetimi
- Müşteri CRUD
- Araç CRUD
- Araç kabul sihirbazı (6 adım)
- Fotoğraf kontrol listesi
- 2D SVG araç hasar işaretleme
- Mock SMS onayı (demo modu)
- Müşteri çıktı linki (`/s/[token]`)
- Servis emri yapısı
- Audit log
- Tenant izolasyonu

## Rotalar

### Genel
- `/` — Açılış sayfası
- `/privacy` — Gizlilik politikası
- `/terms` — Kullanım koşulları
- `/s/[token]` — Müşteri çıktı sayfası

### Auth
- `/login` — Giriş
- `/register` — Kayıt

### Panel
- `/app` — Dashboard
- `/app/workshop` — İş yeri profili
- `/app/customers` — Müşteri listesi
- `/app/customers/new` — Yeni müşteri
- `/app/vehicles` — Araç listesi
- `/app/vehicles/new` — Yeni araç
- `/app/intakes` — Kabul listesi
- `/app/intakes/new` — Yeni kabul
- `/app/intakes/[id]` — Kabul detayı
- `/app/orders` — Servis emri listesi
- `/app/orders/[id]` — Servis emri detayı
