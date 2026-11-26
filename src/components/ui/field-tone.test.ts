import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { buttonVariants } from "./button"
import { fieldToneClasses } from "./field-tone"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

describe("alan tonu (#953)", () => {
  test("uyarı tonu data-tone seçicisiyle gelir, çıplak sınıf değil", () => {
    expect(fieldToneClasses).toContain("data-[tone=warning]:bg-warning/10")
    expect(fieldToneClasses).toContain("data-[tone=warning]:border-warning/40")
    expect(fieldToneClasses).toContain("data-[tone=warning]:focus-visible:border-warning")
  })

  test("tonlu zeminde placeholder -strong tonla gelir", () => {
    expect(fieldToneClasses).toContain("data-[tone=warning]:placeholder:text-muted-foreground-strong")
  })

  test("aria-invalid ton ile karışmaz: hata çerçevesi tonu ezer", () => {
    expect(fieldToneClasses).toContain("aria-invalid:data-[tone=warning]:border-destructive")
  })

  test("Input, SelectTrigger ve Button field aynı tonu taşır; diğer Button varyantları taşımaz", () => {
    expect(read("./input.tsx")).toContain("fieldToneClasses")
    expect(read("./select.tsx")).toContain("fieldToneClasses")
    expect(buttonVariants({ variant: "field" })).toContain("data-[tone=warning]:bg-warning/10")
    expect(buttonVariants({ variant: "outline" })).not.toContain("data-[tone=warning]")
  })

  test("tone yalnız warning iken data-tone yazılır", () => {
    for (const f of ["./input.tsx", "./select.tsx"]) {
      expect(read(f)).toContain('data-tone={tone === "default" ? undefined : tone}')
    }
  })
})
