import type { AdminRole } from "@prisma/client"

/**
 * Platform yetki modelinin SAF çekirdeği (BAK-93) — rol listesi, etiketler,
 * yetenek matrisi ve oturum-iptali kararı.
 *
 * Neden `admin.ts`'ten ayrı: `admin.ts` prisma ve `next/navigation` çeker, yani
 * istemci bileşenlerinden import edilemez (rol seçici ve gezinme filtresi buna
 * ihtiyaç duyuyor). Buradaki her şey saf ve yan etkisizdir; sunucu tarafı
 * `@/lib/admin` üzerinden aynı isimlere ulaşmaya devam eder.
 */

export type { AdminRole }

export const ADMIN_ROLES = ["founder", "support", "finance", "readonly"] as const satisfies readonly AdminRole[]

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  founder: "Kurucu",
  support: "Destek",
  finance: "Finans",
  readonly: "Görüntüleyici",
}

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  founder: "Her şey — yönetici yönetimi dahil",
  support: "Destek: salt-okunur impersonation, canlı destek, denetim",
  finance: "Faturalandırma teyidi ve dışa aktarım",
  readonly: "Yalnız görüntüleme",
}

export type AdminCapability =
  | "viewConsole"
  | "manageWorkshops"
  | "confirmBilling"
  | "viewAudit"
  | "viewHealth"
  | "impersonate"
  | "sendPasswordReset"
  | "exportData"
  | "manageCatalog"
  | "manageLiveChat"
  | "manageLeads"
  | "manageAdmins"
  | "manageStatusPage"
  | "viewSales"
  | "manageSalesPipeline"
  | "manageSalesAdvisors"
  | "viewSalesCommissions"
  | "manageSalesCommissions"

/**
 * Yetki matrisi — kaynak: `docs/operations/platform-admin-model.md` §2.
 * Çağrı yerleri yeteneği zaten bildiriyor; kısıtlama TEK yerden, bu tablodan yapılır.
 */
const CAPABILITIES: Record<AdminCapability, readonly AdminRole[]> = {
  viewConsole: ["founder", "support", "finance", "readonly"],
  viewAudit: ["founder", "support", "finance", "readonly"],
  viewHealth: ["founder", "support", "readonly"],
  manageWorkshops: ["founder"],
  confirmBilling: ["founder", "finance"],
  exportData: ["founder", "finance"],
  impersonate: ["founder", "support"],
  // BAK-97 — destek müdahalesi: bağlantı yalnız kullanıcının kendi e-postasına
  // gider, konsolda görünmez. Finans ve görüntüleyicinin işi değildir.
  sendPasswordReset: ["founder", "support"],
  manageLiveChat: ["founder", "support"],
  // Dokümandaki matriste yok; demo/destek talebi akışı destek personelinin işi.
  manageLeads: ["founder", "support"],
  manageCatalog: ["founder"],
  manageAdmins: ["founder"],
  // Kesinti iletişimi destek ekibinin de işi (BAK-119/BAK-128) — founder'a kilitli değil.
  manageStatusPage: ["founder", "support"],
  viewSales: ["founder", "support", "finance", "readonly"],
  manageSalesPipeline: ["founder", "support"],
  manageSalesAdvisors: ["founder"],
  viewSalesCommissions: ["founder", "finance"],
  manageSalesCommissions: ["founder", "finance"],
}

/** Capability check against the {@link CAPABILITIES} matrix. */
export function can(ctx: { adminRole: AdminRole }, capability: AdminCapability): boolean {
  return CAPABILITIES[capability].includes(ctx.adminRole)
}

/** Rolün sahip olduğu tüm yetkiler — gezinmeyi filtrelemek için. */
export function adminCapabilities(ctx: { adminRole: AdminRole }): AdminCapability[] {
  return (Object.keys(CAPABILITIES) as AdminCapability[]).filter((c) => can(ctx, c))
}

/**
 * Oturum iptali kararı — saf fonksiyon (test edilebilir olsun diye ayrı).
 *
 * `sessionsValidFrom` NULL ise hiç iptal edilmemiştir. Doluysa oturumun bu andan
 * SONRA açılmış olduğu KANITLANMALIDIR: damgası olmayan çerez (bu alan gelmeden
 * önce açılmış oturum) reddedilir. Aksi hâlde "tüm oturumları kapat" 7 güne kadar
 * hiçbir şey yapmamış olurdu.
 */
export function isAdminSessionRevoked(
  authenticatedAt: number | undefined,
  sessionsValidFrom: Date | null
): boolean {
  if (!sessionsValidFrom) return false
  if (typeof authenticatedAt !== "number") return true
  return authenticatedAt < sessionsValidFrom.getTime()
}
