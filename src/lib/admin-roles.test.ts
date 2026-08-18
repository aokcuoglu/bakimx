import { expect, test, describe } from "bun:test"
import {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  adminCapabilities,
  can,
  isAdminSessionRevoked,
  type AdminCapability,
  type AdminRole,
} from "@/lib/admin-roles"

/**
 * BAK-93 — platform yetki matrisi + oturum iptali.
 *
 * `can()` ve `isAdminSessionRevoked()` bilerek SAF fonksiyondur; kapının kararı
 * DB'siz test edilebilsin diye. Matris kaynağı:
 * `docs/operations/platform-admin-model.md` §2.
 */

function ctx(adminRole: AdminRole) {
  return { adminRole }
}

describe("can() yetki matrisi", () => {
  test("her rolün etiketi vardır", () => {
    expect(Object.keys(ADMIN_ROLE_LABELS).sort()).toEqual([...ADMIN_ROLES].sort())
  })

  test("kurucu diğer tüm rollerin yetkilerini kapsar", () => {
    const founderCaps = adminCapabilities(ctx("founder"))
    for (const role of ADMIN_ROLES) {
      for (const cap of adminCapabilities(ctx(role))) {
        expect(founderCaps).toContain(cap)
      }
    }
  })

  test("readonly hassas işlemleri yapamaz", () => {
    const forbidden: AdminCapability[] = [
      "impersonate",
      "confirmBilling",
      "manageWorkshops",
      "manageFlags",
      "manageCatalog",
      "manageLiveChat",
      "manageLeads",
      "manageAdmins",
      "exportData",
      "sendPasswordReset",
    ]
    for (const cap of forbidden) {
      expect(can(ctx("readonly"), cap)).toBe(false)
    }
    expect(can(ctx("readonly"), "viewConsole")).toBe(true)
    expect(can(ctx("readonly"), "viewAudit")).toBe(true)
  })

  test("destek impersonate edebilir, faturalandırma teyit edemez", () => {
    expect(can(ctx("support"), "impersonate")).toBe(true)
    expect(can(ctx("support"), "manageLiveChat")).toBe(true)
    expect(can(ctx("support"), "confirmBilling")).toBe(false)
    expect(can(ctx("support"), "manageAdmins")).toBe(false)
  })

  test("şifre sıfırlama gönderimi yalnız kurucu ve destektedir (BAK-97)", () => {
    expect(can(ctx("founder"), "sendPasswordReset")).toBe(true)
    expect(can(ctx("support"), "sendPasswordReset")).toBe(true)
    expect(can(ctx("finance"), "sendPasswordReset")).toBe(false)
    expect(can(ctx("readonly"), "sendPasswordReset")).toBe(false)
  })

  test("finans faturalandırmayı teyit eder, impersonate edemez", () => {
    expect(can(ctx("finance"), "confirmBilling")).toBe(true)
    expect(can(ctx("finance"), "exportData")).toBe(true)
    expect(can(ctx("finance"), "impersonate")).toBe(false)
    expect(can(ctx("finance"), "manageWorkshops")).toBe(false)
  })

  test("yönetici yönetimi yalnız kurucudadır", () => {
    for (const role of ADMIN_ROLES) {
      expect(can(ctx(role), "manageAdmins")).toBe(role === "founder")
    }
  })

  test("her rol konsolu görebilir", () => {
    for (const role of ADMIN_ROLES) {
      expect(can(ctx(role), "viewConsole")).toBe(true)
    }
  })
})

describe("isAdminSessionRevoked()", () => {
  const t0 = new Date("2026-08-17T10:00:00Z")

  test("iptal noktası yoksa oturum geçerlidir", () => {
    expect(isAdminSessionRevoked(t0.getTime(), null)).toBe(false)
    expect(isAdminSessionRevoked(undefined, null)).toBe(false)
  })

  test("iptal noktasından ÖNCE açılmış oturum reddedilir", () => {
    expect(isAdminSessionRevoked(t0.getTime() - 1, t0)).toBe(true)
  })

  test("iptal noktasından SONRA açılmış oturum kabul edilir", () => {
    expect(isAdminSessionRevoked(t0.getTime() + 1, t0)).toBe(false)
  })

  test("damgasız (eski) çerez iptal edilmiş sayılır", () => {
    // `authenticatedAt` bu özellikten önce açılmış oturumlarda YOK. Kabul etseydik
    // "tüm oturumları kapat" 7 gün boyunca hiçbir şey yapmamış olurdu.
    expect(isAdminSessionRevoked(undefined, t0)).toBe(true)
  })
})
