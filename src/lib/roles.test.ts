import { expect, test } from "bun:test"
import {
  ASSIGNABLE_ROLES,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  roleCan,
  rolesUpTo,
} from "./roles"
import type { UserRole } from "@prisma/client"

const ALL_ROLES: UserRole[] = ["owner", "manager", "usta", "cirak", "staff"]

test("manager yetkileri Servis Danışmanı etiketiyle gösterilir", () => {
  expect(ROLE_LABELS.manager).toBe("Servis Danışmanı")
})

test("her rol için etiket, açıklama, sıra ve izin listesi tanımlı", () => {
  for (const r of ALL_ROLES) {
    expect(ROLE_LABELS[r]).toBeTruthy()
    expect(ROLE_DESCRIPTIONS[r]).toBeTruthy()
    expect(ROLE_RANK[r]).toBeGreaterThan(0)
    expect(Array.isArray(ROLE_PERMISSIONS[r])).toBe(true)
  }
})

test("matriste tanımsız izin adı yok", () => {
  for (const r of ALL_ROLES) {
    for (const p of ROLE_PERMISSIONS[r]) expect(PERMISSIONS).toContain(p)
  }
})

test("owner tüm izinlere sahiptir", () => {
  for (const p of PERMISSIONS) expect(roleCan("owner", p)).toBe(true)
})

/** #183'ün çekirdeği: kapalı iş emrini yalnız Yönetici yeniden açabilir. */
test("kapalı iş emrini yeniden açmak yalnız owner'a açıktır", () => {
  expect(roleCan("owner", "order.reopen")).toBe(true)
  for (const r of ["manager", "usta", "cirak", "staff"] as UserRole[]) {
    expect(roleCan(r, "order.reopen")).toBe(false)
  }
})

test("faturalama yalnız owner'a açıktır", () => {
  expect(roleCan("owner", "billing.manage")).toBe(true)
  for (const r of ["manager", "usta", "cirak", "staff"] as UserRole[]) {
    expect(roleCan(r, "billing.manage")).toBe(false)
  }
})

test("ekip yönetimi owner ve manager ile sınırlıdır", () => {
  expect(roleCan("owner", "team.manage")).toBe(true)
  expect(roleCan("manager", "team.manage")).toBe(true)
  for (const r of ["usta", "cirak", "staff"] as UserRole[]) {
    expect(roleCan(r, "team.manage")).toBe(false)
  }
})

test("ayarlar ve kayıt yönetimi doğru rollere açık", () => {
  expect(roleCan("manager", "settings.manage")).toBe(true)
  expect(roleCan("usta", "settings.manage")).toBe(false)
  expect(roleCan("usta", "records.manage")).toBe(true)
  expect(roleCan("cirak", "records.manage")).toBe(false)
})

test("çırak kayıt oluşturabilir ve parça alımı yapabilir, düzenleyemez", () => {
  expect(ROLE_PERMISSIONS.cirak).toEqual(["records.create", "parts.purchase"])
  expect(roleCan("cirak", "records.create")).toBe(true)
  expect(roleCan("cirak", "order.edit")).toBe(false)
  expect(roleCan("cirak", "order.status")).toBe(false)
  expect(roleCan("cirak", "cashbox.manage")).toBe(false)
})

test("kayıt oluşturma tüm rollere açıktır", () => {
  for (const r of ALL_ROLES) expect(roleCan(r, "records.create")).toBe(true)
})

test("usta iş emrini düzenler ve ilerletir, kasa/katalog yönetemez", () => {
  expect(roleCan("usta", "order.edit")).toBe(true)
  expect(roleCan("usta", "order.status")).toBe(true)
  expect(roleCan("usta", "parts.purchase")).toBe(true)
  expect(roleCan("usta", "catalog.manage")).toBe(false)
  expect(roleCan("usta", "cashbox.manage")).toBe(false)
})

/**
 * Göç güvenliği: #183 öncesi kullanıcıların hepsi `staff`. Operasyonel kapı
 * eklendiği için, staff'ın izinleri usta ile BİREBİR aynı kalmalı — aksi hâlde
 * mevcut atölyelerde insanlar bir sabah yetkisiz kalır.
 */
test("legacy staff, usta ile birebir aynı izinlere sahiptir", () => {
  expect([...ROLE_PERMISSIONS.staff]).toEqual([...ROLE_PERMISSIONS.usta])
})

test("staff yeni atama listesinde yer almaz", () => {
  expect(ASSIGNABLE_ROLES).not.toContain("staff")
  expect(ASSIGNABLE_ROLES).toEqual(["cirak", "usta", "manager", "owner"])
})

test("kimse kendinden yüksek rol atayamaz", () => {
  expect(rolesUpTo("cirak")).toEqual(["cirak"])
  expect(rolesUpTo("usta")).toEqual(["cirak", "usta"])
  expect(rolesUpTo("manager")).toEqual(["cirak", "usta", "manager"])
  expect(rolesUpTo("owner")).toEqual(["cirak", "usta", "manager", "owner"])
})

test("legacy staff aktör da owner atayamaz", () => {
  expect(rolesUpTo("staff")).not.toContain("owner")
  expect(rolesUpTo("staff")).not.toContain("manager")
})

/**
 * Sıra ile izin ayrı eksenler; matris sırayı takip etmek ZORUNDA değil ama
 * yüksek sıralı bir rol düşük sıralıdan daha az izne sahip olmamalı.
 */
test("yüksek sıralı rol, düşük sıralının izinlerini kapsar", () => {
  const ordered = [...ALL_ROLES].sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b])
  for (let i = 1; i < ordered.length; i++) {
    const lower = ROLE_PERMISSIONS[ordered[i - 1]]
    const higher = ROLE_PERMISSIONS[ordered[i]]
    if (ROLE_RANK[ordered[i]] === ROLE_RANK[ordered[i - 1]]) continue
    for (const p of lower) expect(higher).toContain(p)
  }
})
