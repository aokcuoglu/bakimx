import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8")

describe("PublicSite okuma ilerleme çubuğu (#1000)", () => {
  test("PublicSite framer-motion içe aktarmaz (BAK-165)", () => {
    expect(read("./PublicSite.tsx")).not.toContain("framer-motion")
  })

  test(".progress animasyonu prefers-reduced-motion: no-preference bloğunda, varsayılan gizli", () => {
    const css = read("./public-site.module.css")
    const media = css.indexOf("@media (prefers-reduced-motion: no-preference)")
    const anim = css.indexOf("animation-timeline: scroll(root")
    expect(media).toBeGreaterThan(-1)
    expect(anim).toBeGreaterThan(media)
    expect(css).toContain("animation-duration: auto")
    // Medya bloğunun dışındaki kural çubuğu gizli bırakır.
    expect(css.slice(0, css.indexOf("@supports")).includes("display: none")).toBe(true)
  })
})
