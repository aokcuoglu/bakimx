import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ana sayfa e-santral.com/bakimx düzeninde (#781). Bu kaynak taramaları,
 * hidrasyondan sonra tarayıcıda görülemeyen gerilemeleri yakalar: LCP başlığının
 * gizli başlaması (BAK-165), takip konumlarının düşmesi, fiyatın JSON-LD ile
 * ayrışması ve paylaşılan menünün artık olmayan çapalara bağlanması.
 */
const ROOT = join(import.meta.dir, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const LANDING_DIR = "src/components/marketing/landing";
const landingFiles = () =>
  readdirSync(join(ROOT, LANDING_DIR))
    .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name))
    .map((name) => `${LANDING_DIR}/${name}`);

describe("ana sayfa sözleşmeleri", () => {
  test("ana sayfa framer-motion ve PublicSite kullanmaz", () => {
    const page = read("src/app/page.tsx");
    expect(page).not.toMatch(/framer-motion|PublicSite/);
    for (const file of landingFiles()) expect(read(file)).not.toContain("framer-motion");
  });

  test("hero başlığı gizli başlamaz", () => {
    const hero = read(`${LANDING_DIR}/hero.tsx`);
    const heading = hero.match(/<h1[\s\S]*?<\/h1>/)?.[0];
    expect(heading).toBeDefined();
    expect(heading).not.toMatch(/Reveal|opacity|enter-up|hidden/);
    expect(hero).not.toContain("<Reveal");
  });

  test("JSON-LD fiyatı içerikteki fiyattan okunur", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain("PRICE.monthlyPriceTry");
    expect(page).toContain("LANDING_FAQ");
  });

  test("CTA konumları takip edilir", () => {
    const source = landingFiles().map(read).join("\n");
    for (const location of ["header", "hero_primary", "hero_secondary", "move_primary", "move_secondary", "price", "final"]) {
      expect(source).toContain(`"${location}"`);
    }
  });

  test("paylaşılan menü artık olmayan ana sayfa çapalarına bağlanmaz", () => {
    for (const file of ["src/components/sections/Header.tsx", "src/components/sections/Footer.tsx"]) {
      expect(read(file)).not.toMatch(/"\/#(neden|sss)"/);
    }
  });
});
