import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
const publicFile = (p: string) => new URL(`../../../public${p}`, import.meta.url);

describe("landing ürün akışı demosu", () => {
  test("ProductStage canlı akış panelini gömer", () => {
    const page = read("../../app/page.tsx");
    const stage = read("../../components/sections/ProductStage.tsx");
    expect(page).not.toContain("WorkflowDemoSection");
    expect(page).toContain("ProductTourSection");
    expect(stage).toContain("WorkflowDemoPanel");
    expect(stage).toContain('id="workflow"');
  });

  test("ruhsat görseli ve mock app demosu bağlı", () => {
    const panel = read("../../components/sections/WorkflowDemoSection.tsx");
    const stage = read("../../components/sections/ProductStage.tsx");
    const mock = read("../../components/sections/mock-app-demo.tsx");
    expect(panel).toContain("/landing/ruhsat-demo.png");
    expect(existsSync(publicFile("/landing/ruhsat-demo.png"))).toBe(true);
    expect(stage).toContain("MockAppDemo");
    expect(mock).toContain("Yeni İş Emri");
    expect(mock).toContain("Genel Bakış");
    expect(existsSync(publicFile("/landing/screens/mock-app-tour.gif"))).toBe(true);
  });

  test("Mac pencereleri ve staggered LandingMotion (DESIGN.md)", () => {
    const stage = read("../../components/sections/ProductStage.tsx");
    const panel = read("../../components/sections/WorkflowDemoSection.tsx");
    const mac = read("../../components/sections/mac-window.tsx");
    const site = read("../../components/public/PublicSite.tsx");
    const motion = read("../../components/shared/landing-motion.tsx");
    const ops = read("../../components/sections/LandingContent.tsx");
    expect(stage).toContain("LandingStagger");
    expect(stage).toContain("LandingItem");
    expect(stage).toContain('variant="window"');
    expect(stage).not.toContain("useScroll");
    expect(motion).toContain("staggerChildren");
    expect(motion).toContain("opacity: 0");
    expect(motion).toContain("y: 40");
    expect(motion).toContain("y: 56");
    expect(ops).toContain("LandingStagger");
    expect(panel).not.toContain("framer-motion");
    expect(stage).toContain("MacWindow");
    expect(mac).toContain("Kapat");
    expect(mac).toContain("Simge durumuna küçült");
    expect(mac).toContain("Büyüt");
    expect(site).toContain("scaleX: scrollYProgress");
    expect(site).not.toContain("y: [64, 0]");
  });

  test("akış ruhsat → iş emri → parça → hava filtresi", () => {
    const panel = read("../../components/sections/WorkflowDemoSection.tsx");
    for (const label of [
      "Ruhsat okut",
      "İş emri oluştur",
      "Araca özel parça listesi",
      "Hava filtresi seç",
    ]) {
      expect(panel).toContain(label);
    }
    expect(panel).not.toContain("Plaka okut");
  });
});
