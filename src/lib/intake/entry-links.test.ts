import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CREATE_OPTIONS } from "@/components/layout/create-center"
import { NEW_INTAKE_HREF } from "@/lib/intake/entry-links"
import { parseEntryMethod } from "@/lib/intake/entry-wizard"
import { isSidebarlessRoute } from "@/lib/sidebarless-route"

const url = new URL(NEW_INTAKE_HREF, "http://localhost")

describe("ofisin Yeni Araç Kabul hedefi (#813)", () => {
  test("kabulü plaka kamerasıyla açar", () => {
    expect(url.pathname).toBe("/orders/new")
    expect(parseEntryMethod(url.searchParams.get("entry") ?? undefined)).toBe("plate")
  })

  test("teknisyen akışı DEĞİLDİR: ofis kabuğu (sidebar) kalır", () => {
    expect(url.searchParams.has("from")).toBe(false)
    expect(isSidebarlessRoute(url.pathname, url.searchParams)).toBe(false)
  })

  test("oluşturma merkezinin Araç Kabul seçeneği bu hedefe gider", () => {
    expect(CREATE_OPTIONS.find((option) => option.id === "order")?.href).toBe(NEW_INTAKE_HREF)
  })

  // Sayfa başlığındaki "Yeni Araç Kabul" düğmesi #823'ten beri kayıttan gelir
  // (page-headers.ts); sayfada yalnız boş durum düğmeleri kalır.
  // Genel Bakış ve Araç Kabulleri sunucu bileşenleri; render etmeden ancak
  // kaynaktan bakılabilir. Çıplak "/orders/new" geri gelirse o düğme kamerasız
  // eski sihirbaza döner.
  test.each([
    ["Genel Bakış", "src/app/(app)/dashboard/page.tsx", 1],
    ["Araç Kabulleri", "src/app/(app)/orders/page.tsx", 1],
  ])("%s düğmeleri ortak hedefi kullanır", (_label, file, uses) => {
    const source = readFileSync(join(process.cwd(), file), "utf8")
    expect(source).not.toContain('"/orders/new"')
    expect(source.match(/NEW_INTAKE_HREF\b/g)?.length ?? 0).toBeGreaterThanOrEqual(uses + 1)
  })

  test("sayfa başlığı kaydındaki Yeni Araç Kabul düğmesi ortak hedefi kullanır", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/navigation/page-headers.ts"), "utf8")
    expect(source).not.toContain('"/orders/new"')
    expect(source).toContain("href: NEW_INTAKE_HREF")
  })
})
