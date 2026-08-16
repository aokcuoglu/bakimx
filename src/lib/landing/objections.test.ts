import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

import { LANDING_OBJECTIONS, objectionFaqAnchor } from "./objections";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
const publicFile = (p: string) => new URL(`../../../public${p}`, import.meta.url);

describe("landing itiraz kartları", () => {
  test("sekiz itirazın hepsi eksiksiz ve kimlikleri benzersiz", () => {
    expect(LANDING_OBJECTIONS).toHaveLength(8);

    const ids = LANDING_OBJECTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const objection of LANDING_OBJECTIONS) {
      expect(objection.id).toMatch(/^[a-z0-9-]+$/);
      expect(objection.question.length).toBeGreaterThan(10);
      expect(objection.answer.length).toBeGreaterThan(20);
      expect(objection.screenshotAlt.length).toBeGreaterThan(10);
      // Soru müşterinin cümlesi; tırnakları kart/SSS ekliyor, veride olmamalı.
      expect(objection.question).not.toContain("“");
    }
  });

  test("her kartın kanıt görseli gerçekten diskte var", () => {
    // Yeniden adlandırılan bir `id` sessizce 404'e düşerdi: kart metni durur,
    // görsel kaybolur. Bu testin tek işi o sessizliği kırmak.
    for (const objection of LANDING_OBJECTIONS) {
      expect(objection.screenshot).toBe(`/landing/objections/${objection.id}.png`);
      expect(existsSync(publicFile(objection.screenshot))).toBe(true);
    }
  });

  test("kartın linki kendi SSS maddesine gider", () => {
    for (const objection of LANDING_OBJECTIONS) {
      expect(objection.href).toBe(`/#${objectionFaqAnchor(objection.id)}`);
    }
  });

  test("tedarikçi fiyatı vaadi kendi alış fiyatlarıyla sınırlı", () => {
    // Dürüstlük kuralı (BAK-80): canlı piyasa/parça fiyatı çekmiyoruz. Metin
    // bunu "kendi ... fiyatlarınız" diye söylemek zorunda.
    const supplier = LANDING_OBJECTIONS.find((o) => o.id === "tedarikci-fiyat");

    expect(supplier).toBeDefined();
    expect(supplier!.answer).toContain("kendi tedarikçi alış fiyatlarınız");
  });

  test("metinler tek veri dosyasında — bileşenler kendi kopyasını tutmuyor", () => {
    const card = read("../../components/sections/ObjectionCards.tsx");
    const faq = read("../../components/sections/FAQSection.tsx");

    expect(card).toContain("LANDING_OBJECTIONS");
    expect(faq).toContain("LANDING_OBJECTIONS");

    for (const objection of LANDING_OBJECTIONS) {
      expect(card).not.toContain(objection.question);
      expect(card).not.toContain(objection.answer);
      expect(faq).not.toContain(objection.question);
      expect(faq).not.toContain(objection.answer);
    }
  });

  test("şerit görselleri LCP yarışına girmiyor", () => {
    const card = read("../../components/sections/ObjectionCards.tsx");
    const hero = read("../../components/sections/HeroSection.tsx");

    // Yalnız JSX prop'unu ara — "priority" kelimesi açıklama satırlarında geçiyor.
    const priorityProp = /^\s*priority(\s*=|\s*$)/m;

    expect(card).toContain('loading="lazy"');
    expect(card).not.toMatch(priorityProp);
    // Hero'nun LCP'si artık H1 metni; sağ kolonda öncelikli görsel kalmadı.
    expect(hero).not.toMatch(priorityProp);
  });
});
