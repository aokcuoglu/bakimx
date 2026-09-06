import { expect, test } from "bun:test";
import { FAQ_ITEMS, LANDING_FAQ_ITEMS } from "./faq-data";

test("FAQ_ITEMS doludur ve her öğe soru+cevap içerir", () => {
  expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);
  for (const item of FAQ_ITEMS) {
    expect(item.question.trim().length).toBeGreaterThan(0);
    expect(item.answer.trim().length).toBeGreaterThan(0);
  }
});

test("landing SSS'i kısa bir editoryal seçimdir, tam SSS korunur", () => {
  expect(LANDING_FAQ_ITEMS.length).toBe(5);
  expect(LANDING_FAQ_ITEMS.length).toBeLessThan(FAQ_ITEMS.length);
  expect(LANDING_FAQ_ITEMS.every((item) => item.showOnLanding)).toBe(true);
});
