/**
 * Geçici şifre kapısının SUNUCU tarafı (BAK-37).
 *
 * `(app)/layout.tsx` tam ekran şifre değiştirme ekranını gösterir, ama o yalnız
 * UX katmanıdır: geçici şifreyle açılmış bir oturum çerezini alıp server
 * action'lara doğrudan istek atmak o HTML'i hiç görmez. Kapının yazma yolunun
 * kendisinde durduğunu bu dosya sabitler.
 *
 * Prisma'ya dokunmadan test edilebilsin diye `assertPasswordChanged` saf
 * bırakıldı; modül yine de `@/lib/db` import ettiği için mock'lanır.
 */
import { test, expect, mock } from "bun:test"
import type { AuthUser } from "./auth"

mock.module("@/lib/db", () => ({ prisma: {} }))

const { assertPasswordChanged, PasswordChangeRequiredError } = await import("./auth")

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: null,
    username: "mehmet.yilmaz",
    workshopId: "ws-1",
    firstName: "Mehmet",
    lastName: "Yılmaz",
    role: "usta",
    isActive: true,
    mustChangePassword: false,
    ...over,
  }
}

test("geçici şifresi duran kullanıcı yazma yapamaz", () => {
  expect(() => assertPasswordChanged(user({ mustChangePassword: true }))).toThrow(
    PasswordChangeRequiredError
  )
})

test("şifresini değiştirmiş kullanıcı normal çalışır", () => {
  expect(() => assertPasswordChanged(user())).not.toThrow()
})

test("kurucu impersonation'ı kapıdan muaftır", () => {
  // Kilitli hesabı inceleyen kurucudan başkasının şifresini belirlemesi istenemez;
  // yazma yetkisi zaten kendi salt-okunur bayrağıyla sınırlı.
  expect(() =>
    assertPasswordChanged(user({ mustChangePassword: true, impersonatorAdminId: "admin-1" }))
  ).not.toThrow()
})

test("kapı hatası kullanıcıya okunur bir mesaj taşır", () => {
  const error = new PasswordChangeRequiredError()
  expect(error.name).toBe("PasswordChangeRequiredError")
  expect(error.message).toContain("şifrenizi değiştirmeniz")
})
