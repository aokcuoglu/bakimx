import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sectionsDir = join(import.meta.dir, "..", "components", "sections");
const heroSource = readFileSync(join(sectionsDir, "HeroSection.tsx"), "utf8");

describe("landing performance and conversion contracts", () => {
  // Browser tests exercise the rendered page, keyboard navigation, mobile
  // overflow, FAQ data and demo submission. These guards retain regressions
  // that cannot be detected after hydration alone.
  test("hero heading is server-visible and the product stage avoids LCP regressions", () => {
    const heading = heroSource.match(/<h1([\s\S]*?)<\/h1>/)?.[0];
    expect(heading).toBeDefined();
    expect(heading).not.toMatch(/initial=|animate=|enter-up|opacity-0/);
    expect(heroSource).not.toContain("framer-motion");
    expect(heroSource).not.toContain("<Carousel");
    expect(heroSource).toContain("İş emri 10 saniyede");
    expect(heroSource).toContain("Şaseden parça listesi");
    expect(heroSource).toContain("Her kayıt yerinde");
    expect(heroSource).not.toMatch(/^\s*(priority|preload)(\s*=|\s*$)/m);
    expect(heroSource).not.toContain("setInterval");
  });

  test("Lite acquisition preserves hero placement attribution and the demo CTA", () => {
    expect(heroSource).toContain('cta_location: "hero_primary"');
    expect(heroSource).toContain('cta_location: "hero_secondary"');
    expect(heroSource).toContain('"lite_cta_click"');
    expect(heroSource).toContain('plan_tier: "lite"');
    expect(heroSource).toContain('href="/register"');
    expect(heroSource).not.toContain("Lite 0 TL/ay");
    expect(heroSource).not.toContain("Kredi kartı gerekmez");
    expect(heroSource).toContain('"demo_cta_click"');
  });
});
