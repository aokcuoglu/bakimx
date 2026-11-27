import { describe, expect, test } from "bun:test"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { eachTsx, utilityVariants } from "./jsx-source-scan"

/**
 * #998 (#952 takibi) — form kontrolü ata seçicisiyle ezilmez.
 *
 * `control-call-sites.test.ts` yalnız kontrolün KENDİ `className`'ini görür.
 * `<div className="[&_input]:border-0 [&_input]:bg-transparent">` kontrole hiç
 * dokunmadan görünümünü ezer ve o kapıdan geçer (#952'de ~70 çağrı yeri böyle
 * yazılmıştı). Hayalet/inline/sessiz alan görünümü `Input appearance` /
 * `InputGroup appearance` varyantından gelir.
 *
 * Kural: `components/ui/` dışında hiçbir sınıf, torun seçicisiyle bir form
 * kontrolünü hedeflemez — `[&_input]`, `[&_textarea]`, `[&_select]`,
 * `[&>input]`, `[&_[data-slot=input…]]`, `[&_[data-slot=select-trigger]]`,
 * `**:data-[slot=input…]` vb. Kontrol olmayan torun seçicileri
 * (`[&_svg]`, `[&_[data-slot=icon-box]]`) serbesttir.
 */

const CONTROL_TAGS = /^(?:input|textarea|select)$/
const CONTROL_SLOT = /^(?:input|textarea|select|combobox|autocomplete|checkbox|switch|radio)(?:-|$)/

const slotOf = (text: string) => text.match(/data-\[?slot=["']?([a-z0-9-]+)/)?.[1]

/** Varyant listesi (`utilityVariants`) bir form kontrolünü torun olarak hedefliyor mu? */
export function targetsFormControl(variants: readonly string[]): boolean {
  return variants.some((variant, i) => {
    // `**:data-[slot=input]:` / `*:data-[slot=…]:` — yıldız ardından slot varyantı.
    if (variant === "*" || variant === "**") {
      const slot = slotOf(variants[i + 1] ?? "")
      return slot !== undefined && CONTROL_SLOT.test(slot)
    }
    // `[&_input]:`, `[&>textarea]:`, `[&_[data-slot=input-group]]:`
    const bracket = variant.match(/^\[&[\s_>+~]*(.*)\]$/)
    if (!bracket) return false
    const slot = slotOf(bracket[1])
    if (slot !== undefined) return CONTROL_SLOT.test(slot)
    const tag = bracket[1].match(/^([a-z]+)/)?.[1]
    return tag !== undefined && CONTROL_TAGS.test(tag)
  })
}

/** Kaynaktaki tüm sınıf adaylarından kontrol hedefleyen ata seçicilileri döndürür. */
export function controlAncestorSelectors(source: string): string[] {
  const hits: string[] = []
  for (const token of source.match(/[^\s"'`{}]*(?:\[&|\*:)[^\s"'`{}]*(?:\[[^\s"'`]*\][^\s"'`{}]*)*/g) ?? []) {
    if (targetsFormControl(utilityVariants(token))) hits.push(token)
  }
  return hits
}

const SRC = fileURLToPath(new URL("../../", import.meta.url))

describe("form kontrolü ata seçicisiyle ezilmez (#998)", () => {
  test("seçici tanıma: kontrol hedefleyenler yakalanır", () => {
    for (const cls of [
      "[&_input]:border-0",
      "[&>input]:bg-transparent",
      "[&_textarea]:resize-none",
      "[&_select]:h-8",
      "[&_[data-slot=input-group]]:shadow-none",
      "[&_[data-slot=input]]:border-0",
      "[&_[data-slot=select-trigger]]:bg-transparent",
      "md:[&_input]:h-7",
      "**:data-[slot=input]:border-0",
    ]) {
      expect(controlAncestorSelectors(`<div className="flex ${cls}" />`)).toEqual([cls])
    }
  })

  test("seçici tanıma: kontrol olmayan torunlar serbest", () => {
    for (const cls of [
      "[&_svg]:size-4",
      "[&_[data-slot=icon-box]]:bg-primary-foreground/15",
      "[&>svg]:size-4",
      "[&_p]:mb-0",
      "**:data-[slot=accordion-trigger]:py-5",
      "[&_button]:py-5",
      "h-9 border-0",
    ]) {
      expect(controlAncestorSelectors(`<div className="${cls}" />`)).toEqual([])
    }
  })

  test("components/ui dışında kontrol hedefleyen ata seçicisi yok", () => {
    const offenders: string[] = []
    eachTsx(
      SRC,
      (path, source) => {
        const file = relative(SRC, path).split(sep).join("/")
        for (const hit of controlAncestorSelectors(source)) offenders.push(`${file}: ${hit}`)
      },
      (path) => `${relative(SRC, path)}${sep}`.startsWith(`components${sep}ui${sep}`)
    )
    expect(offenders).toEqual([])
  })
})
