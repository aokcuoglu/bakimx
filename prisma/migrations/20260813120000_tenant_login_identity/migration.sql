-- BAK-40 — Tenant bazlı giriş çekirdeği: iş yeri kodu + tenant içi kullanıcı adı.
--
-- GERİYE DÖNÜK ETKİ: mevcut kullanıcıların e-postaları aynen kalır, hiçbir kimse
-- giriş kaybetmez. Eklenen kullanıcı alanlarının hepsi nullable veya varsayılanlı.
-- Tek zorunlu yeni alan `Workshop.loginCode`; NOT NULL yapılmadan ÖNCE mevcut
-- satırlar için iş yeri adından türetilip dolduruluyor (aşağıdaki DO bloğu).
--
-- GERİ ALMA: CHECK kısıtları + unique index'ler düşürülüp yeni kolonlar DROP
-- edilir. `User.email` tekrar NOT NULL yapılacaksa önce e-postasız kullanıcıların
-- temizlenmesi gerekir — o yüzden geri alma tek yönlü güvenli değildir.

-- 1) Workshop.loginCode — önce nullable ekle, backfill et, sonra kilitle.
ALTER TABLE "Workshop" ADD COLUMN "loginCode" TEXT;

DO $$
DECLARE
  w         RECORD;
  base      TEXT;
  candidate TEXT;
  n         INT;
  reserved  TEXT[] := ARRAY['login','api','app','admin','www','demo','invite','payment','s','p'];
BEGIN
  FOR w IN SELECT id, name FROM "Workshop" ORDER BY "createdAt", id LOOP
    -- `src/lib/workshop-code.ts` ile aynı kural: Türkçe harfler ASCII'ye indirgenir
    -- (lower() ÖNCESİ — 'İ' aksi hâlde birleşen noktaya bölünür), geri kalan her
    -- şey tireye döner, baş/son tireler atılır, 20 karaktere kırpılır.
    base := regexp_replace(
              left(
                regexp_replace(
                  regexp_replace(
                    lower(translate(w.name, 'ÇĞİIÖŞÜçğıöşüÂÎÛâîû', 'CGIIOSUcgiosuAIUaiu')),
                    '[^a-z0-9]+', '-', 'g'),
                  '(^-+)|(-+$)', '', 'g'),
                20),
              '-+$', '', 'g');

    -- Slug çıkmadıysa (ör. yalnız sembollerden oluşan ad) veya uygulamanın kendi
    -- yollarıyla çakışıyorsa tabana düş; benzersizliği aşağıdaki döngü sağlar.
    IF base IS NULL OR length(base) < 3 OR base = ANY(reserved) THEN
      base := 'atolye';
    END IF;

    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "Workshop" WHERE "loginCode" = candidate) LOOP
      n := n + 1;
      candidate := regexp_replace(left(base, 20 - (length(n::text) + 1)), '-+$', '', 'g')
                   || '-' || n::text;
    END LOOP;

    UPDATE "Workshop" SET "loginCode" = candidate WHERE id = w.id;
  END LOOP;
END $$;

ALTER TABLE "Workshop" ALTER COLUMN "loginCode" SET NOT NULL;
CREATE UNIQUE INDEX "Workshop_loginCode_key" ON "Workshop"("loginCode");

-- 2) User — e-postasız kimlik.
-- Postgres unique index birden çok NULL'a izin verdiği için `User_email_key`
-- olduğu gibi kalabilir: e-postası olan herkes için benzersizlik sürüyor.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Kullanıcı adları GLOBAL değil, tenant içinde benzersiz — her atölyede bir
-- "ahmet" olabilir. (username NULL olan satırlar bu index'i tüketmez.)
CREATE UNIQUE INDEX "User_workshopId_username_key" ON "User"("workshopId", "username");

-- 3) Veri bütünlüğü — uygulama katmanına GÜVENİLMEZ, kısıtlar DB'de durur.
-- Prisma şeması CHECK ifade edemediği için bunlar yalnız burada tanımlıdır;
-- ikizleri `src/lib/user-identity.ts` içinde kullanıcıya hata mesajı üretir.

-- Girişsiz kullanıcı yaratılamaz: ileride bir kod yolu e-postayı da kullanıcı
-- adını da boş bırakırsa sessizce erişilemez bir hesap doğardı.
ALTER TABLE "User" ADD CONSTRAINT "User_identity_present"
  CHECK ("email" IS NOT NULL OR "username" IS NOT NULL);

-- owner/manager e-postasız olamaz: fatura, şifre sıfırlama ve sistem bildirimleri
-- oraya gidiyor. Rol YÜKSELTME yolunu da kapatır — e-postasız bir `usta`,
-- e-posta eklenmeden `manager`'a terfi ettirilemez.
ALTER TABLE "User" ADD CONSTRAINT "User_privileged_role_requires_email"
  CHECK ("role" NOT IN ('owner', 'manager') OR "email" IS NOT NULL);
