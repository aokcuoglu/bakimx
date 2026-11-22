import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroSection } from "@/components/sections/HeroSection";

const sectionsDir = join(import.meta.dir, "..", "components", "sections");
const heroSource = readFileSync(join(sectionsDir, "HeroSection.tsx"), "utf8");

describe("landing performance and conversion contracts", () => {
  test("the retired standalone registration demo stays off the home page", () => {
    const homeSource = readFileSync(join(import.meta.dir, "page.tsx"), "utf8");
    expect(homeSource).not.toContain("RuhsatDemoSection");
  });
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

  // #780: the collage lines are stacked spans, so without a separator their
  // text read as "saniyedeŞaseden" to crawlers and to the section's
  // aria-labelledby name. The flex column drops whitespace-only text nodes, so
  // the separator is invisible.
  test("hero heading text keeps a space between collage lines", () => {
    const html = renderToStaticMarkup(createElement(HeroSection));
    const heading = html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
    const text = heading.replace(/<[^>]+>/g, "");
    expect(text).toBe("İş emri 10 saniyede Şaseden parça listesi Her kayıt yerinde");
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
