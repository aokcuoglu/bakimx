import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CREATE_OPTIONS } from "@/components/layout/create-center"
import { NEW_INTAKE_HREF, newIntakeHref } from "@/lib/intake/entry-links"
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

describe("bağlamlı Yeni Araç Kabul adresleri (#832)", () => {
  const params = (href: string) => new URL(href, "http://localhost").searchParams

  test("müşteriden: kamera (entry=plate) + customerId, teknisyen akışı değil", () => {
    const q = params(newIntakeHref({ customerId: "c1" }))
    expect(q.get("entry")).toBe("plate")
    expect(q.get("customerId")).toBe("c1")
    expect(q.has("vehicleId")).toBe(false)
    expect(q.has("from")).toBe(false)
  })

  test("araçtan: kamera + vehicleId (varsa customerId)", () => {
    const q = params(newIntakeHref({ vehicleId: "v1", customerId: "c1" }))
    expect(q.get("entry")).toBe("plate")
    expect(q.get("vehicleId")).toBe("v1")
    expect(q.get("customerId")).toBe("c1")
  })

  test("boş bağlam düz hedefle aynı; id'ler kodlanır", () => {
    expect(newIntakeHref({ customerId: null, vehicleId: "" })).toBe(NEW_INTAKE_HREF)
    expect(params(newIntakeHref({ customerId: "a&b=c" })).get("customerId")).toBe("a&b=c")
  })

  // Bu ekranlardaki "Yeni Araç Kabul" elle yazılmış `/orders/new?…` adresine
  // dönerse kamerasız eski sihirbaz açılır.
  test.each([
    "src/components/customers/customer-detail.tsx",
    "src/components/customers/customer-list.tsx",
    "src/components/quotes/quote-list.tsx",
    "src/components/appointments/appointment-list.tsx",
    "src/components/vehicles/vehicle-detail.tsx",
    "src/components/vehicles/vehicle-list.tsx",
    "src/components/reminders/reminder-detail.tsx",
  ])("%s adresi newIntakeHref ile kurar", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8")
    expect(source).not.toMatch(/[`"']\/orders\/new\?/)
    expect(source).toContain("newIntakeHref(")
  })
})
