import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";

import { HERO_SLIDES } from "./hero-slides";

const publicFile = (path: string) =>
  new URL(`../../../public${path}`, import.meta.url);

describe("landing hero carousel", () => {
  test("uses three truthful, uniquely identified product stories", () => {
    expect(HERO_SLIDES).toHaveLength(3);
    expect(new Set(HERO_SLIDES.map((slide) => slide.id)).size).toBe(3);

    for (const slide of HERO_SLIDES) {
      expect(slide.eyebrow.length).toBeGreaterThan(5);
      expect(slide.title.length + slide.highlight.length).toBeGreaterThan(20);
      expect(slide.description.length).toBeGreaterThan(30);
      expect(slide.bullets).toHaveLength(3);
      expect(slide.bullets.every((bullet) => bullet.length > 8)).toBe(true);
    }
  });

  test("self-hosts every AI background as an optimized WebP asset", () => {
    for (const slide of HERO_SLIDES) {
      expect(slide.image).toMatch(/^\/landing\/hero\/[a-z0-9-]+\.webp$/);
      expect(existsSync(publicFile(slide.image))).toBe(true);
    }
  });

  test("does not claim price comparison or marketplace availability", () => {
    const copy = JSON.stringify(HERO_SLIDES).toLocaleLowerCase("tr-TR");

    expect(copy).not.toContain("fiyat karşılaştır");
    expect(copy).not.toContain("en ucuz");
    expect(copy).not.toContain("stokta");
  });
});
