import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const appDir = import.meta.dir;
const sectionsDir = join(appDir, "..", "components", "sections");
const pageSource = readFileSync(join(appDir, "page.tsx"), "utf8");
const heroSource = readFileSync(join(sectionsDir, "HeroSection.tsx"), "utf8");

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
  "DemoFormSection",
  "FinalCTASection",
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
    const heading = heroSource.match(/<motion\.h1([\s\S]*?)<\/motion\.h1>/)?.[0];

    expect(heading).toBeDefined();
    expect(heading).not.toContain("initial=");
    expect(heading).not.toContain("animate=");
  });
});
