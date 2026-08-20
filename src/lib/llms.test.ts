import { describe, expect, it } from "bun:test"
import { buildLlmsTxt, LLMS_PUBLIC_PATHS } from "@/lib/llms"
import { INDEXABLE_ROUTES, SITE_URL } from "@/lib/seo"

describe("llms.txt", () => {
  it("yalnız canonical ve public P0 URL'lerini listeler", () => {
    const body = buildLlmsTxt()

    expect(LLMS_PUBLIC_PATHS).toHaveLength(6)
    for (const [, path] of LLMS_PUBLIC_PATHS) {
      expect(INDEXABLE_ROUTES).toContain(path)
      expect(body).toContain(new URL(path, SITE_URL).toString())
    }
    expect(body).not.toContain("app.bakimx.com")
    expect(body).not.toContain("/login")
  })
})
