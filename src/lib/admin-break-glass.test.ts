import { describe, expect, test } from "bun:test"
import {
  BREAK_GLASS_ADMIN_EMAIL,
  isAdminAuthenticationAllowed,
  isBreakGlassAdminEmail,
} from "./admin-break-glass"

describe("break-glass admin identity", () => {
  test("matches the dedicated address case-insensitively", () => {
    expect(isBreakGlassAdminEmail(" BreakGlass@BakimX.com ")).toBe(true)
    expect(BREAK_GLASS_ADMIN_EMAIL).toBe("breakglass@bakimx.com")
  })

  test("does not classify an ordinary admin as break-glass", () => {
    expect(isBreakGlassAdminEmail("alpkaan@bakimx.com")).toBe(false)
  })
})

describe("admin authentication method gate", () => {
  test("allows Google SSO for an ordinary platform admin", () => {
    expect(isAdminAuthenticationAllowed({
      email: "alpkaan@bakimx.com",
      authMethod: "google_sso",
    })).toBe(true)
  })

  test("allows password only for the dedicated break-glass identity", () => {
    expect(isAdminAuthenticationAllowed({
      email: BREAK_GLASS_ADMIN_EMAIL,
      authMethod: "password",
    })).toBe(true)
    expect(isAdminAuthenticationAllowed({
      email: "alpkaan@bakimx.com",
      authMethod: "password",
    })).toBe(false)
  })

  test("allows a password session to reach the membership gate only in development", () => {
    expect(isAdminAuthenticationAllowed({
      email: "admin@bakimx.com",
      authMethod: "password",
      isDevelopment: true,
    })).toBe(true)
    expect(isAdminAuthenticationAllowed({
      email: "admin@bakimx.com",
      authMethod: "password",
      isDevelopment: false,
    })).toBe(false)
  })

  test("fails closed for legacy sessions without an authentication method", () => {
    expect(isAdminAuthenticationAllowed({
      email: BREAK_GLASS_ADMIN_EMAIL,
      authMethod: undefined,
    })).toBe(false)
  })

  test("allows the QA login only in development", () => {
    expect(isAdminAuthenticationAllowed({
      email: "admin@bakimx.com",
      authMethod: "development",
      isDevelopment: true,
    })).toBe(true)
    expect(isAdminAuthenticationAllowed({
      email: "admin@bakimx.com",
      authMethod: "development",
      isDevelopment: false,
    })).toBe(false)
  })
})
