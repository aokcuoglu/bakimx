import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Workshop Login Page — Next.js 16 async params fix
 *
 * BAK-50: The page uses `params` and `searchParams` as Promises in Next.js 16+,
 * requiring `await` to unwrap them. Previously, the code tried to access
 * `params.code` directly, causing a TypeError since params was a Promise.
 *
 * This test verifies:
 * 1. The page file exists and exports an async function
 * 2. The function signature uses Promise types for params and searchParams
 * 3. The redirect import was removed (since we now get it from searchParams)
 */

const pageSource = readFileSync(join(import.meta.dir, "page.tsx"), "utf8")

describe("Workshop Login Page — Next.js 16 params async fix", () => {
  it("should export async function with Promise-based params", () => {
    // Verify the function is declared as async
    expect(pageSource).toMatch(/export default async function/)
  })

  it("should use Promise<{ code: string }> for params", () => {
    // Verify params is typed as Promise
    expect(pageSource).toMatch(/params:\s*Promise<\s*{\s*code:\s*string\s*}\s*>/)
  })

  it("should use Promise<{ redirect?: string }> for searchParams", () => {
    // Verify searchParams is typed as Promise
    expect(pageSource).toMatch(/searchParams:\s*Promise<\s*{\s*redirect\?\s*:\s*string\s*}\s*>/)
  })

  it("should await params before using it", () => {
    // Verify we await params
    expect(pageSource).toMatch(/const\s*{\s*code:\s*rawCode\s*}\s*=\s*await\s*params/)
  })

  it("should await searchParams before using it", () => {
    // Verify we await searchParams
    expect(pageSource).toMatch(/const\s*{\s*redirect\s*}\s*=\s*await\s*searchParams/)
  })

  it("should not import redirect from next/navigation", () => {
    // Verify the unused import was removed
    expect(pageSource).not.toMatch(/import.*redirect.*from.*next\/navigation/)
  })

  it("should use redirect from searchParams instead", () => {
    // Verify we're using the redirect variable from searchParams
    expect(pageSource).toMatch(/redirect={redirect}/)
  })

  it("should handle workshop code lookup correctly", () => {
    // Verify the page queries by loginCode
    expect(pageSource).toMatch(/loginCode:\s*code/)
  })

  it("should display workshop not found message for invalid code", () => {
    // Verify the error UI is present
    expect(pageSource).toMatch(/İş yeri bulunamadı/)
  })
})
