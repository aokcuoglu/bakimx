import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ana sayfa e-santral.com/bakimx düzeninde (#781). Bu kaynak taramaları,
 * hidrasyondan sonra tarayıcıda görülemeyen gerilemeleri yakalar: LCP başlığının
 * gizli başlaması (BAK-165), takip konumlarının düşmesi, fiyatın JSON-LD ile
 * ayrışması ve paylaşılan menünün artık olmayan çapalara bağlanması.
 */
const ROOT = join(import.meta.dir, "..", "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const LANDING_DIR = "src/components/marketing/landing";
const landingFiles = () =>
  readdirSync(join(ROOT, LANDING_DIR))
    .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name))
    .map((name) => `${LANDING_DIR}/${name}`);

describe("ana sayfa sözleşmeleri", () => {
  test("ana sayfa framer-motion ve PublicSite kullanmaz", () => {
    const page = read("src/app/(site)/page.tsx");
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
    const page = read("src/app/(site)/page.tsx");
    expect(page).toContain("PRICE.monthlyPriceTry");
    expect(page).toContain("LANDING_FAQ");
  });

  test("Organization verisi sameAs taşıyan ortak tanımdan gelir (#780)", () => {
    const page = read("src/app/(site)/page.tsx");
    expect(page).toContain("ORGANIZATION_STRUCTURED_DATA");
    expect(page).not.toContain('"@type": "Organization"');
  });

  test("CTA konumları takip edilir", () => {
    const source = landingFiles().map(read).join("\n");
    for (const location of ["header", "hero_primary", "hero_secondary", "move_primary", "move_secondary", "price", "final"]) {
      expect(source).toContain(`"${location}"`);
    }
  });

  test("tüm Ücretsiz deneyin düğmeleri kayıt penceresini açar (#783)", () => {
    const sections = landingFiles().filter((file) => !/signup-dialog|content\.ts|callback-dialog/.test(file));
    const source = sections.map(read).join("\n");
    expect(source).not.toMatch(/href="\/register"/);
    expect(source.match(/<SignupTrigger\b/g)?.length).toBe(5);
    // Sağlayıcı (#798'den beri) üst bandı da kapsayan (site) layout'unda.
    expect(read("src/app/(site)/layout.tsx")).toContain("<SignupDialogProvider>");
  });

  test("paylaşılan alt bant artık olmayan ana sayfa çapalarına bağlanmaz", () => {
    // Üst bant (#798'den beri) çapalarını content.ts'teki NAV'dan alır; eski
    // sections/Header kaldırıldı.
    expect(read("src/components/sections/Footer.tsx")).not.toMatch(/"\/#(neden|sss)"/);
  });
});
