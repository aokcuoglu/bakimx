import type { AdminRole } from "@prisma/client"
import { prisma } from "@/lib/db"

/**
 * Platform yöneticiliği ÜYELİK kararının tek kaynağı (BAK-114).
 *
 * Neden ayrı dosya: aynı soruyu iki giriş yolu soruyor — şifreli giriş
 * (`@/lib/admin`, `resolveAdmin`) ve Google SSO callback'i (`@/lib/admin-sso`,
 * `resolveSsoAdmin`). BAK-93 + BAK-94 sonrasında bu iki yol kararı ayrı ayrı
 * veriyordu ve ayrıştılar: SSO env bootstrap'ını hiç çalıştırmıyordu, yani
 * `PlatformAdmin` tablosu boşken `/admin-login` kendi kendine açılamayan bir
 * kapıydı — açılması için önce şifreli yoldan geçmek gerekiyordu. Karar artık
 * yalnız burada verilir; iki yol da bu fonksiyonu çağırır.
 *
 * Kurallar (değişmedi, yalnız tek yere toplandı):
 *
 * 1. **Tablo doluysa tek kaynak DB'dir.** Env'de adı geçen ama satırı olmayan
 *    biri yönetici DEĞİLDİR — offboarding tek noktadan (DB) yapılabilsin.
 * 2. **`ADMIN_EMAILS` yalnız bootstrap yoludur.** Tablo BOŞKEN devreye girer ve
 *    listedeki adresleri `founder` olarak yazar.
 * 3. **Otomatik hesap açma yok.** Listede olmayan bir adres, tablo boş olsa bile
 *    giremez ve kendine kayıt yaratamaz.
 */

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.trim().toLowerCase())
}

/**
 * Env allowlist'ini tabloya taşır (tek seferlik, idempotent). `skipDuplicates`
 * eşzamanlı iki isteğin yarışını zararsız kılar. Best-effort: yazma hatası
 * konsola giriş yapılmasını ENGELLEMEZ (çağıran yakalar) — aksi hâlde geçici bir
 * yazma sorunu kurucuyu kendi konsolundan kilitlerdi.
 */
async function materializeEnvAdmins(): Promise<void> {
  const emails = getAdminEmails()
  if (emails.length === 0) return

  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true },
  })
  if (users.length === 0) return

  await prisma.platformAdmin.createMany({
    data: users.map((u) => ({ userId: u.id, role: "founder" as const })),
    skipDuplicates: true,
  })
}

export interface AdminMembership {
  adminRole: AdminRole
  /** `PlatformAdmin.id`; bootstrap yazması başarısız olduysa null. */
  platformAdminId: string | null
  /** Oturum iptali kararını çağıran verir (`isAdminSessionRevoked`). */
  sessionsValidFrom: Date | null
  /** Üyelik bu istekte env bootstrap'ı ile açıldıysa true — denetimde ayırt edilir. */
  viaEnvBootstrap: boolean
}

/**
 * Kullanıcının platform üyeliği, ya da yönetici değilse null.
 *
 * Sıra: (1) DB satırı — erişimi kapatılmışsa reddet, (2) satır yoksa ve env'de
 * adı geçiyorsa YALNIZ tablo boşken bootstrap.
 *
 * Oturum iptali (`sessionsValidFrom`) burada KARARA katılmaz; damga istek
 * kapsamına bağlı olduğu için çağırana bırakılır — SSO callback'i zaten yeni bir
 * oturum açar, şifreli yol ise mevcut çerezin damgasıyla karşılaştırır.
 */
export async function resolveAdminMembership(user: {
  id: string
  email: string | null
}): Promise<AdminMembership | null> {
  if (!user.email) return null

  const row = await prisma.platformAdmin.findUnique({
    where: { userId: user.id },
    select: { id: true, role: true, disabledAt: true, sessionsValidFrom: true },
  })

  if (row) {
    if (row.disabledAt) return null
    return {
      adminRole: row.role,
      platformAdminId: row.id,
      sessionsValidFrom: row.sessionsValidFrom,
      viaEnvBootstrap: false,
    }
  }

  if (!isAdminEmail(user.email)) return null
  // Tablo doluysa env'in sözü geçmez — offboarding tek noktadan (DB) yapılabilsin.
  if ((await prisma.platformAdmin.count()) > 0) return null

  let bootstrapped: { id: string; sessionsValidFrom: Date | null } | null = null
  try {
    await materializeEnvAdmins()
    bootstrapped = await prisma.platformAdmin.findUnique({
      where: { userId: user.id },
      select: { id: true, sessionsValidFrom: true },
    })
  } catch (err) {
    console.error("[admin] env bootstrap materialization failed:", err instanceof Error ? err.message : err)
  }

  return {
    adminRole: "founder",
    platformAdminId: bootstrapped?.id ?? null,
    sessionsValidFrom: bootstrapped?.sessionsValidFrom ?? null,
    viaEnvBootstrap: true,
  }
}
