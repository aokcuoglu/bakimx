-- BAK-107: Kullanıcı rolü personel rolünün tek kaynağı olur. Eski teknisyen
-- kayıtları ve bütün iş geçmişi yerinde kalır; yalnız personeli olmayan
-- kullanıcılar için deterministik, geri alınabilir Technician satırları açılır.
ALTER TYPE "TechnicianRole" ADD VALUE IF NOT EXISTS 'cirak';

INSERT INTO "Technician" (
  "id", "workshopId", "fullName", "phone", "role", "isActive", "createdAt", "updatedAt"
)
SELECT
  'bak107_' || md5(u."id"),
  u."workshopId",
  COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u."firstName", u."lastName")), ''), u."email", u."username", 'Personel'),
  '',
  CASE u."role"::text
    WHEN 'owner' THEN 'yonetici'::"TechnicianRole"
    WHEN 'manager' THEN 'servis_danismani'::"TechnicianRole"
    WHEN 'cirak' THEN 'cirak'::"TechnicianRole"
    ELSE 'usta'::"TechnicianRole"
  END,
  u."isActive",
  u."createdAt",
  NOW()
FROM "User" u
WHERE u."technicianId" IS NULL;

UPDATE "User" u
SET "technicianId" = 'bak107_' || md5(u."id")
WHERE u."technicianId" IS NULL;

-- Rollback notu: önce `User.technicianId` alanını `bak107_%` kayıtları için
-- NULL yapın, ardından aynı prefix'li Technician kayıtlarını silin. ALTER TYPE
-- enum değerini PostgreSQL'de güvenle geri almak tabloyu yeniden kurmayı
-- gerektirir; `cirak` değeri veri taşımadığı doğrulandıktan sonra yapılmalıdır.
