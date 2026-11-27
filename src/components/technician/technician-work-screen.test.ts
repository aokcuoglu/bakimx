import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const read = (...parts: string[]) => readFileSync(join(import.meta.dir, ...parts), "utf8")
const orchestrator = read("technician-order-detail.tsx")
const workScreenDir = join(import.meta.dir, "work-screen")
const screenSources = [
  orchestrator,
  ...readdirSync(workScreenDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(workScreenDir, f), "utf8")),
]
const screen = screenSources.join("\n")
const partsSection = read("technician-parts-labor-section.tsx")
const actions = readFileSync(join(import.meta.dir, "../../app/(app)/technician/actions.ts"), "utf8")
const routeDir = join(import.meta.dir, "../../app/(app)/technician/orders/[id]")

function block(source: string, startMarker: string): string {
  const start = source.indexOf(startMarker)
  expect(start).toBeGreaterThan(-1)
  const next = source.indexOf("\nexport async function ", start + startMarker.length)
  return source.slice(start, next === -1 ? undefined : next)
}

describe("teknisyen iş ekranı (kiosk)", () => {
  test("sihirbaz kalıntısı yok", () => {
    for (const banned of ["?step", "localStorage", "WizardActions", "TECHNICIAN_ORDER_STEPS", "bg-primary/[0.04]", "toLocale"]) {
      expect(screen).not.toContain(banned)
    }
    expect(screen).not.toContain("<Tabs")
  })

  test("kutucuklar ve birincil eylem saf kurallardan gelir", () => {
    expect(orchestrator).toContain("workScreenTiles(")
    expect(orchestrator).toContain("workPrimaryAction(")
    expect(orchestrator).toContain("startWorkWithTimerAction")
    expect(orchestrator).toContain("permissions: WorkScreenPermissions")
  })

  test("Parça bekliyor tek yerde, bitirme kapısı ve onayı korunur", () => {
    expect(orchestrator.split("Parça bekliyor").length - 1).toBe(1)
    expect(orchestrator).toContain("completeWorkBlockMessage(")
    expect(orchestrator).toContain("AlertDialog")
    expect(orchestrator).toContain("İş tamamlandı olarak işaretlensin mi?")
  })

  test("aç/kapa bölüm Collapsible ile, elle aria-expanded/details yok", () => {
    expect(orchestrator).toContain("CollapsibleTrigger asChild")
    expect(screen).not.toContain("aria-expanded")
    expect(screen).not.toContain("<details")
  })

  test("eski talep akışı ve dış işçilik süzgeci korunur", () => {
    expect(orchestrator).toMatch(/type !== "external_labor"/)
    expect(orchestrator).toContain("externalLaborItems")
    expect(orchestrator).toContain("findUndecidedPartsRequests")
    expect(partsSection).toContain("allowExternalLabor={false}")
  })

  test("rota yükleme ve hata durumları taşır", () => {
    expect(existsSync(join(routeDir, "loading.tsx"))).toBe(true)
    expect(existsSync(join(routeDir, "error.tsx"))).toBe(true)
  })
})

describe("iş ekranı server action'ları", () => {
  test("startWorkWithTimerAction yetki, transaction, satır kilidi ve atölye kapsamı taşır", () => {
    const src = block(actions, "export async function startWorkWithTimerAction")
    expect(src).toContain('requireWritableWorkshop("order.status")')
    expect(src).toContain("$transaction")
    expect(src).toContain("FOR UPDATE")
    expect(src).toContain("workshopId: user.workshopId")
  })

  test("bitirme kapısı yazmadan önce çalışır; bekle/bitir sayacı kapatır", () => {
    const complete = block(actions, "export async function completeWorkAction")
    expect(complete.indexOf("completeWorkBlockMessage(")).toBeGreaterThan(-1)
    expect(complete.indexOf("completeWorkBlockMessage(")).toBeLessThan(complete.indexOf("$transaction"))
    expect(complete).toContain("closeActiveLaborSession(")
    expect(block(actions, "export async function holdWorkAction")).toContain("closeActiveLaborSession(")
  })

  test("eski startWorkAction kaldırıldı", () => {
    expect(actions).not.toMatch(/export async function startWorkAction\b/)
  })
})
