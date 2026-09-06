import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sectionsDir = join(import.meta.dir, "..", "components", "sections");
const heroSource = readFileSync(join(sectionsDir, "HeroSection.tsx"), "utf8");

describe("landing performance and conversion contracts", () => {
  // Browser tests exercise the rendered page, keyboard navigation, mobile
  // overflow, FAQ data and demo submission. These guards retain regressions
  // that cannot be detected after hydration alone.
  test("hero heading is not gated behind an animation or a rotating slide", () => {
    const heading = heroSource.match(/<h1([\s\S]*?)<\/h1>/)?.[0];
    expect(heading).toBeDefined();
    expect(heading).not.toMatch(/initial=|animate=|enter-up|opacity-0/);
    expect(heroSource).not.toContain("framer-motion");
    expect(heroSource).not.toContain("<Carousel");
    expect(heroSource).not.toContain("setInterval");
  });

  test("redesign preserves the hero conversion attribution", () => {
    expect(heroSource).toContain('cta_location: "hero_primary"');
    expect(heroSource).toContain('cta_location: "hero_secondary"');
    expect(heroSource).toContain('"trial_cta_click"');
    expect(heroSource).toContain('"demo_cta_click"');
  });
});
