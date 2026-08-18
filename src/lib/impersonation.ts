import { prisma } from "@/lib/db"

/**
 * İmpersonation oturumunun İPTAL FARKINDALIĞI (BAK-96).
 *
 * Overlay bilerek DB'ye gitmeden çözülüyor (`src/lib/session.ts` — `expiresAt`
 * epoch ms). Bu, 30 dakikalık zaman aşımını tek kontrol hâline getiriyordu:
 * başlamış bir oturumu üçüncü bir kişi durduramıyordu. Gerçek iptal, kimliği
 * çözen yolda bir DB kontrolü gerektiriyor.
 *
 * MALİYET — kontrol YALNIZ çerezde overlay varken çalışır. Overlay yoksa
 * (isteklerin fiilen tamamı) hiçbir ek sorgu yoktur. Overlay varken istek başına
 * BİR birincil anahtar `findUnique`'i eklenir (`getCurrentUser` içinde);
 * `(app)/layout.tsx` artık ikinci bir çağrı yapmıyor, etkin kullanıcıdan türetiyor.
 * Ölçüm ve gerekçe PR gövdesindedir.
 *
 * Bu modül prisma çektiği için `@/lib/session`'dan AYRIDIR: session modülü
 * `src/middleware.ts` üzerinden Edge runtime'a giriyor.
 */

/**
 * Oturum artık geçerli mi? `true` → overlay yok sayılmalı.
 *
 * FAIL-CLOSED: satır bulunamazsa (silinmiş/uydurulmuş sessionId) iptal edilmiş
 * sayılır. DB hatası BİLEREK yutulmaz — `getCurrentUser()` sözleşmesi gereği
 * "altyapı çökük" ile "kimlik çözülemedi" ayrı olaylardır
 * (`src/lib/auth-session-errors.test.ts`).
 */
export async function isImpersonationRevoked(sessionId: string): Promise<boolean> {
  const row = await prisma.impersonationSession.findUnique({
    where: { id: sessionId },
    select: { endedAt: true, revokedAt: true },
  })
  if (!row) return true
  return row.revokedAt !== null || row.endedAt !== null
}

export interface ActiveImpersonationRow {
  id: string
  adminEmail: string
  workshopId: string
  workshopName: string
  targetEmail: string | null
  reason: string | null
  startedAt: Date
  expiresAt: Date
}

/**
 * Süresi dolmamış, kapatılmamış ve iptal edilmemiş oturumlar — `/admin` listesi.
 * Yönetici e-postası `User.email` üzerinden okunur; `null` olamaz (platform
 * yöneticisi her zaman e-postalı hesaptır, bkz. `AdminUser`) ama tip nullable
 * olduğu için düşülür.
 */
export async function getActiveImpersonationSessions(): Promise<ActiveImpersonationRow[]> {
  const sessions = await prisma.impersonationSession.findMany({
    where: { endedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      adminUserId: true,
      targetUserId: true,
      targetWorkshopId: true,
      reason: true,
      startedAt: true,
      expiresAt: true,
    },
  })
  if (sessions.length === 0) return []

  const userIds = [...new Set(sessions.flatMap((s) => [s.adminUserId, s.targetUserId]))]
  const [users, workshops] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, username: true },
    }),
    prisma.workshop.findMany({
      where: { id: { in: [...new Set(sessions.map((s) => s.targetWorkshopId))] } },
      select: { id: true, name: true },
    }),
  ])
  const userById = new Map(users.map((u) => [u.id, u]))
  const workshopNameById = new Map(workshops.map((w) => [w.id, w.name]))

  return sessions.map((s) => {
    const admin = userById.get(s.adminUserId)
    const target = userById.get(s.targetUserId)
    return {
      id: s.id,
      adminEmail: admin?.email ?? admin?.username ?? s.adminUserId,
      workshopId: s.targetWorkshopId,
      workshopName: workshopNameById.get(s.targetWorkshopId) ?? s.targetWorkshopId,
      targetEmail: target?.email ?? target?.username ?? null,
      reason: s.reason,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
    }
  })
}
