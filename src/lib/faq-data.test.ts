import { expect, test } from "bun:test";
import { FAQ_ITEMS } from "./faq-data";

test("FAQ_ITEMS doludur ve her öğe soru+cevap içerir", () => {
  expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);
  for (const item of FAQ_ITEMS) {
    expect(item.question.trim().length).toBeGreaterThan(0);
    expect(item.answer.trim().length).toBeGreaterThan(0);
  }
});

test("fiyat cevabı tek paketi anlatır ve satıştan kalkan paketleri anmaz (#782)", () => {
  const pricing = FAQ_ITEMS.find((item) => item.question === "Fiyatlandırma nasıl çalışıyor?")
  expect(pricing?.answer).toContain("Servis Paketi")
  expect(pricing?.answer).toContain("₺1.499")
  expect(pricing?.answer).toContain("₺14.990")
  const all = FAQ_ITEMS.map((item) => item.answer).join(" ")
  expect(all).not.toMatch(/\bLite\b|Profesyonel|Premium/)
});
