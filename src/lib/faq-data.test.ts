import { expect, test } from "bun:test";
import { FAQ_ITEMS } from "./faq-data";

test("FAQ_ITEMS doludur ve her öğe soru+cevap içerir", () => {
  expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);
  for (const item of FAQ_ITEMS) {
    expect(item.question.trim().length).toBeGreaterThan(0);
    expect(item.answer.trim().length).toBeGreaterThan(0);
  }
});
