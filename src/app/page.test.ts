import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buttonVariants } from "@/components/ui/button";

const appDir = import.meta.dir;
const sectionsDir = join(appDir, "..", "components", "sections");
const pageSource = readFileSync(join(appDir, "page.tsx"), "utf8");
const heroSource = readFileSync(join(sectionsDir, "HeroSection.tsx"), "utf8");
const headerSource = readFileSync(join(sectionsDir, "Header.tsx"), "utf8");

const landingOrder = [
  "AnnouncementBar",
  "Header",
  "HeroSection",
  "PartnersStrip",
  "RuhsatDemoSection",
  "FeatureShowcaseSection",
  "StandOutSection",
  "SegmentsSection",
  "BeforeAfterSection",
  "TrustOnboardingSection",
  "FAQSection",
  // Koyu bookend + form kapanışı (UI denetimi §3.5): FinalCTA formdan ÖNCE,
  // demo formu sayfayı kapatır — secondary CTA aşağı kaydırır, yukarı değil.
  "FinalCTASection",
  "DemoFormSection",
  "Footer",
];

describe("landing page composition", () => {
  test("renders the approved sections in order", () => {
    const renderPositions = landingOrder.map((section) =>
      pageSource.indexOf(`<${section} />`, pageSource.indexOf("return (")),
    );

    expect(renderPositions.every((position) => position >= 0)).toBe(true);
    expect(renderPositions).toEqual([...renderPositions].sort((a, b) => a - b));
  });

  test("does not keep the removed duplicate and unmeasured-metric sections", () => {
    expect(pageSource).not.toContain("PillarsSection");
    expect(pageSource).not.toContain("MetricsBand");
    expect(existsSync(join(sectionsDir, "PillarsSection.tsx"))).toBe(false);
    expect(existsSync(join(sectionsDir, "MetricsBand.tsx"))).toBe(false);
  });

  test("keeps the LCP heading visible on the initial server paint", () => {
    const heading = heroSource.match(/<h1([\s\S]*?)<\/h1>/)?.[0];

    expect(heading).toBeDefined();
    expect(heading).not.toContain("initial=");
    expect(heading).not.toContain("animate=");
    expect(heading).not.toContain("enter-up");
  });

  test("uses the shared accessible carousel with controllable autoplay", () => {
    expect(heroSource).toContain("<Carousel");
    expect(heroSource).toContain("AUTOPLAY_DELAY_MS");
    expect(heroSource).toContain("usePrefersReducedMotion");
    expect(heroSource).toContain("prefersReducedMotion ? 0 : 22");
    expect(heroSource).toContain("Carousel otomatik geçişini duraklat");
    expect(heroSource).toContain('aria-label="Önceki slayt"');
    expect(heroSource).toContain('aria-label="Sonraki slayt"');
    expect(heroSource).not.toContain("framer-motion");
    expect(heroSource).not.toContain("<button");
  });

  test("keeps the full-bleed background, heading hierarchy, and CTA analytics contract", () => {
    expect(heroSource).toContain('sizes="100vw"');
    expect(heroSource).toContain("absolute inset-0 bg-gradient-to-r");
    expect(heroSource).not.toContain("grid-cols-1");
    expect(heroSource.match(/<h1/g)).toHaveLength(1);
    expect(heroSource).toContain('cta_location: "hero_primary"');
    expect(heroSource).toContain('cta_location: "hero_secondary"');
    expect(heroSource).not.toContain("hero_${slide.id}");
  });

  test("uses a collision-free inverse variant for the transparent header CTA", () => {
    const inverseClasses = buttonVariants({ variant: "inverse" });

    expect(headerSource).toContain(
      'variant={transparent ? "inverse" : "default"}',
    );
    expect(inverseClasses).toContain("bg-navy-foreground");
    expect(inverseClasses).toContain("text-navy");
    expect(inverseClasses).not.toContain("text-primary-foreground");
  });
});
