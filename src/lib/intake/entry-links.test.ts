import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CREATE_OPTIONS } from "@/components/layout/create-center"
import { NEW_INTAKE_HREF, newIntakeHref, parseIntakeBack } from "@/lib/intake/entry-links"
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

  // Genel Bakış ve Araç Kabulleri sunucu bileşenleri; render etmeden ancak
  // kaynaktan bakılabilir. Çıplak "/orders/new" geri gelirse o düğme kamerasız
  // eski sihirbaza döner.
  test("Araç Kabulleri düğmeleri ortak hedefi kullanır", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/orders/page.tsx"), "utf8")
    expect(source).not.toContain('"/orders/new"')
    expect(source.match(/NEW_INTAKE_HREF\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  test("Genel Bakış düğmeleri kamerayla açar ve Genel Bakış'a döner (#842)", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8")
    expect(source).not.toContain('"/orders/new"')
    expect(source).toContain('newIntakeHref({ back: "/dashboard" })')
    expect(source.match(/DASHBOARD_INTAKE_HREF\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
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
    ["src/components/customers/customer-detail.tsx", "back: `/customers/${customer.id}`"],
    ["src/components/customers/customer-list.tsx", 'back: "/customers"'],
    ["src/components/quotes/quote-list.tsx", 'back: "/quotes"'],
    ["src/components/appointments/appointment-list.tsx", 'back: "/appointments"'],
    ["src/components/vehicles/vehicle-detail.tsx", "back: `/vehicles/${v.id}`"],
    ["src/components/vehicles/vehicle-list.tsx", 'back: "/vehicles"'],
    ["src/components/reminders/reminder-detail.tsx", "back: `/reminders/${reminder.id}`"],
  ])("%s adresi newIntakeHref ile kurar ve geldiği sayfayı taşır (#842)", (file, back) => {
    const source = readFileSync(join(process.cwd(), file), "utf8")
    expect(source).not.toMatch(/[`"']\/orders\/new\?/)
    // Her newIntakeHref çağrısı geri hedefini taşır.
    // Şablon dizesindeki `${…}` de süslü parantez içerir: kapanış ` })`e kadar.
    const calls = source.match(/newIntakeHref\(\{.*?\}\)/g) ?? []
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call).toContain(back)
  })
})

describe("kabul ekranının geri hedefi (#842)", () => {
  test("bilinen liste sayfaları etiketiyle kabul edilir", () => {
    expect(parseIntakeBack("/dashboard")).toEqual({ kind: "page", href: "/dashboard", label: "Genel Bakış" })
    expect(parseIntakeBack("/quotes")).toEqual({ kind: "page", href: "/quotes", label: "Teklifler" })
    expect(parseIntakeBack("/appointments")?.kind).toBe("page")
    expect(parseIntakeBack(["/vehicles", "/x"])).toEqual({ kind: "page", href: "/vehicles", label: "Araçlar" })
  })

  test("müşteri ve araç sayfası id'siyle döner (etiket sayfada çözülür)", () => {
    expect(parseIntakeBack("/customers/cm123_ab-C")).toEqual({ kind: "customer", href: "/customers/cm123_ab-C", id: "cm123_ab-C" })
    expect(parseIntakeBack("/vehicles/v1")).toEqual({ kind: "vehicle", href: "/vehicles/v1", id: "v1" })
    expect(parseIntakeBack("/reminders/r1")).toEqual({ kind: "page", href: "/reminders/r1", label: "Bakım hatırlatması" })
  })

  test.each([
    "//evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/api/vehicles",
    "/customers/../admin",
    "/customers/a/b",
    "/customers/new",
    "/customers?q=x",
    "/parts",
    "dashboard",
    "__proto__",
    "constructor",
    "",
  ])("açık yönlendirme / bilinmeyen hedef reddedilir: %p", (raw) => {
    expect(parseIntakeBack(raw)).toBeNull()
  })

  test("eksik değer null", () => {
    expect(parseIntakeBack(undefined)).toBeNull()
    expect(parseIntakeBack(null)).toBeNull()
  })

  test("newIntakeHref yalnız geçerli geri hedefini yazar", () => {
    const q = (href: string) => new URL(href, "http://localhost").searchParams
    expect(q(newIntakeHref({ customerId: "c1", back: "/customers/c1" })).get("back")).toBe("/customers/c1")
    // "+" menüsü herhangi bir sayfadan açılabilir: bilinmeyen sayfa adrese yazılmaz.
    expect(newIntakeHref({ back: "/parts" })).toBe(NEW_INTAKE_HREF)
    expect(newIntakeHref({ back: "https://evil.example" })).toBe(NEW_INTAKE_HREF)
  })
})
