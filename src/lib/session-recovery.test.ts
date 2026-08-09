import { test, expect } from "bun:test"
import {
  AUTH_BOUNCE_LIMIT,
  isBounceLimitReached,
  nextBounceCount,
  shouldClearSessionOnLogin,
} from "./session-recovery"

test("plan kilidi (?expired=) oturumu imha ettirir", () => {
  expect(shouldClearSessionOnLogin(new URLSearchParams("expired=trial_expired"))).toBe(true)
  expect(shouldClearSessionOnLogin(new URLSearchParams("expired=subscription_expired"))).toBe(true)
})

test("çözülemeyen oturum (?reason=session_invalid) oturumu imha ettirir", () => {
  expect(shouldClearSessionOnLogin(new URLSearchParams("reason=session_invalid"))).toBe(true)
})

test("devre dışı bırakılan hesap (?reason=session_inactive) oturumu imha ettirir", () => {
  // Oturumu açıkken pasife alınan personel: kullanıcı çözülür ama erişimi yoktur.
  // İşaret verilmezse /login ↔ /dashboard döngüsüne girer (bkz. (app)/data.ts).
  expect(shouldClearSessionOnLogin(new URLSearchParams("reason=session_inactive"))).toBe(true)
})

test("sıradan /login ziyareti oturumu imha ETMEZ", () => {
  expect(shouldClearSessionOnLogin(new URLSearchParams(""))).toBe(false)
  expect(shouldClearSessionOnLogin(new URLSearchParams("redirect=/dashboard"))).toBe(false)
  // Tanınmayan değerler sessizce yok sayılır — uydurma parametreyle oturum kapatılamaz.
  expect(shouldClearSessionOnLogin(new URLSearchParams("reason=hede"))).toBe(false)
  expect(shouldClearSessionOnLogin(new URLSearchParams("expired=hede"))).toBe(false)
})

test("sekme sayacı bozuk/eksik değerde 1'den başlar", () => {
  expect(nextBounceCount(undefined)).toBe(1)
  expect(nextBounceCount(null)).toBe(1)
  expect(nextBounceCount("")).toBe(1)
  expect(nextBounceCount("abc")).toBe(1)
  expect(nextBounceCount("-4")).toBe(1)
})

test("sekme sayacı artar", () => {
  expect(nextBounceCount("1")).toBe(2)
  expect(nextBounceCount("2")).toBe(3)
})

test("sağlıklı tek sekme limiti tetiklemez, döngü tetikler", () => {
  expect(isBounceLimitReached("1")).toBe(false)
  expect(isBounceLimitReached(undefined)).toBe(false)
  expect(isBounceLimitReached(String(AUTH_BOUNCE_LIMIT))).toBe(true)
  expect(isBounceLimitReached(String(AUTH_BOUNCE_LIMIT + 5))).toBe(true)
})
