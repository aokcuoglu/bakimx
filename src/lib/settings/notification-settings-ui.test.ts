import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/settings/notification-settings.tsx"),
  "utf8"
)

test("şablon formu react-hook-form + zod, hata Alert'tir", () => {
  expect(SOURCE).toContain("zodResolver(notificationTemplateFormSchema)")
  expect(SOURCE).toContain('<Alert variant="destructive"')
  expect(SOURCE).not.toContain("text-[10px]")
  expect(SOURCE).not.toContain("setEditContent")
})
