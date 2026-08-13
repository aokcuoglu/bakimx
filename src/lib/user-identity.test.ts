import { expect, test } from "bun:test"
import {
  USERNAME_MAX_LENGTH,
  canReceivePasswordReset,
  hasLoginIdentity,
  isEmailIdentifier,
  isValidUsername,
  normalizeUsername,
  roleAllowedForUser,
} from "./user-identity"
import { ROLES_REQUIRING_EMAIL, roleRequiresEmail } from "./roles"
import type { UserRole } from "@prisma/client"

test("kimlik yolu `@` ile seçilir", () => {
  expect(isEmailIdentifier("ahmet@bakimx.com")).toBe(true)
  expect(isEmailIdentifier("ahmet")).toBe(false)
  expect(isEmailIdentifier("ahmet.usta")).toBe(false)
})

test("kullanıcı adı küçük harfe normalize edilir", () => {
  expect(normalizeUsername("  Ahmet_Usta ")).toBe("ahmet_usta")
  // Normalizasyon sayesinde büyük harfle giriş de aynı hesabı bulur.
  expect(normalizeUsername("AHMET")).toBe(normalizeUsername("ahmet"))
})

test("geçerli kullanıcı adı: harf/rakam + tek ayraç, uçlarda ayraç yok", () => {
  expect(isValidUsername("ahmet")).toBe(true)
  expect(isValidUsername("ahmet.usta")).toBe(true)
  expect(isValidUsername("ahmet_2")).toBe(true)
  expect(isValidUsername("ahmet-usta")).toBe(true)
  expect(isValidUsername("AHMET")).toBe(true) // normalize edilerek kabul
})

test("geçersiz kullanıcı adı: kısa, uzun, `@` içeren, uçta ayraç, boşluk", () => {
  expect(isValidUsername("ab")).toBe(false)
  expect(isValidUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(false)
  expect(isValidUsername("ahmet@bakimx.com")).toBe(false) // `@` ayrımı bulanmasın
  expect(isValidUsername("_ahmet")).toBe(false)
  expect(isValidUsername("ahmet.")).toBe(false)
  expect(isValidUsername("ahmet usta")).toBe(false)
  expect(isValidUsername("ahmet__usta")).toBe(false)
})

test("girişsiz kullanıcı olamaz: e-posta veya kullanıcı adı dolu olmalı", () => {
  expect(hasLoginIdentity({ email: "a@b.com", username: null })).toBe(true)
  expect(hasLoginIdentity({ email: null, username: "ahmet" })).toBe(true)
  expect(hasLoginIdentity({ email: "a@b.com", username: "ahmet" })).toBe(true)
  expect(hasLoginIdentity({ email: null, username: null })).toBe(false)
  expect(hasLoginIdentity({})).toBe(false)
})

test("owner/manager e-posta ister, usta/cirak/staff istemez", () => {
  expect(ROLES_REQUIRING_EMAIL).toEqual(["owner", "manager"])
  for (const role of ["owner", "manager"] as UserRole[]) {
    expect(roleRequiresEmail(role)).toBe(true)
  }
  for (const role of ["usta", "cirak", "staff"] as UserRole[]) {
    expect(roleRequiresEmail(role)).toBe(false)
  }
})

test("rol yükseltme: e-postasız hesap owner/manager olamaz", () => {
  const emailless = { email: null }
  const withEmail = { email: "ahmet@bakimx.com" }

  expect(roleAllowedForUser("manager", emailless)).toBe(false)
  expect(roleAllowedForUser("owner", emailless)).toBe(false)
  expect(roleAllowedForUser("manager", withEmail)).toBe(true)
  expect(roleAllowedForUser("owner", withEmail)).toBe(true)

  // Kullanıcı adıyla açılmış hesap usta/çırak olmaya devam edebilir.
  expect(roleAllowedForUser("usta", emailless)).toBe(true)
  expect(roleAllowedForUser("cirak", emailless)).toBe(true)
})

test("şifre sıfırlama: e-postasız kullanıcı bu akışta eşleşmez", () => {
  expect(canReceivePasswordReset({ email: "ahmet@bakimx.com", isActive: true })).toBe(true)
  // E-postasız usta — şifresini atölye sahibi sıfırlar, mail gönderilemez.
  expect(canReceivePasswordReset({ email: null, isActive: true })).toBe(false)
  // Devre dışı hesap da token almaz.
  expect(canReceivePasswordReset({ email: "ahmet@bakimx.com", isActive: false })).toBe(false)
  expect(canReceivePasswordReset(null)).toBe(false)
  expect(canReceivePasswordReset(undefined)).toBe(false)
})
