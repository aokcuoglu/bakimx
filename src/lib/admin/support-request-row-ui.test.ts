import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/app/admin/admin-requests.tsx"),
  "utf8"
)

function supportRequestTrigger(): string {
  const rowStart = SOURCE.indexOf("function SupportRequestRow(")
  const rowEnd = SOURCE.indexOf("export function AdminSupportRequests(", rowStart)
  const row = SOURCE.slice(rowStart, rowEnd)
  const triggerStart = row.indexOf("<Button")
  const triggerEnd = row.indexOf(">", triggerStart)

  return row.slice(triggerStart, triggerEnd + 1)
}

test("destek talebi tetikleyicisi doğal kart yüksekliğini korur", () => {
  const trigger = supportRequestTrigger()
  const className = trigger.match(/className="([^"]+)"/)?.[1]

  expect(trigger).toContain('variant="ghost"')
  expect(trigger).toContain("aria-expanded={expanded}")
  expect(className).toBeDefined()

  const merged = cn(buttonVariants({ variant: "ghost", className }))
  const classes = merged.split(/\s+/)

  expect(classes).toContain("h-auto")
  expect(classes).toContain("justify-start")
  expect(classes).toContain("whitespace-normal")
  expect(classes).not.toContain("h-8")
  expect(classes).not.toContain("bg-primary")
})
