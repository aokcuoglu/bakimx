import { expect, test } from "bun:test"
import { generateOrderReference } from "@/lib/billing/reference"

test("generateOrderReference matches BX-XXXXXX format", () => {
  for (let i = 0; i < 50; i++) {
    expect(generateOrderReference()).toMatch(/^BX-[ACDEFGHJKLMNPQRSTUVWXYZ2345679]{6}$/)
  }
})
