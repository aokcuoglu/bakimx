import { expect, test } from "bun:test";
import { isPublicAssistantPath } from "./site-assistant-visibility";

test("public path'lerde true döner", () => {
  for (const p of ["/", "/fiyatlar", "/demo", "/satin-al", "/terms", "/privacy"]) {
    expect(isPublicAssistantPath(p)).toBe(true);
  }
});

test("public path'in alt yollarında true döner", () => {
  expect(isPublicAssistantPath("/fiyatlar/detay")).toBe(true);
  expect(isPublicAssistantPath("/privacy/kvkk")).toBe(true);
});

test("uygulama/admin/auth yollarında false döner", () => {
  for (const p of ["/dashboard", "/admin", "/admin/leads", "/login", "/register", "/checkout", "/payment", "/orders/123", "/p/abc", "/s/xyz"]) {
    expect(isPublicAssistantPath(p)).toBe(false);
  }
});

test("benzer ama farklı prefix'lerde false döner (kelime sınırı)", () => {
  expect(isPublicAssistantPath("/demoxyz")).toBe(false);
  expect(isPublicAssistantPath("/termsofservice")).toBe(false);
});
