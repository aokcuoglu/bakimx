import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "technician-order-detail.tsx"), "utf8")
const routeDir = join(import.meta.dir, "../../app/(app)/technician/orders/[id]")

describe("teknisyen iş emri adım kabuğu", () => {
  test("onaylanan beş görevi aynı sırayla sunar", () => {
    const labels = [
      "İşi başlat",
      "Araç kontrolü",
      "Yapılacak işler",
      "Parça ve dış hizmet",
      "Fotoğraf ve bitir",
    ]

    let previous = -1
    for (const label of labels) {
      const current = source.indexOf(`label: \"${label}\"`)
      expect(current).toBeGreaterThan(previous)
      previous = current
    }
  })

  test("adımı URL'de ve iş emri bazında cihazda korur", () => {
    expect(source).toContain('params.set("step", step)')
    expect(source).toContain('localStorage.getItem(`bakimx:technician-order:${order.id}:step`)')
    expect(source).toContain('localStorage.setItem(`bakimx:technician-order:${order.id}:step`, step)')
    expect(source).toContain("validRequestedStep ?? rememberedStep ?? derivedStep")
  })

  test("işler tamamlanınca devam akışında parça ve dış hizmet adımını atlamaz", () => {
    expect(source).toMatch(/countIncompleteItems\(order\.items\) > 0[\s\S]*\? "items"[\s\S]*: "needs"/)
  })

  test("sekme şeritlerini taşmada erişilebilir bırakır", () => {
    expect(source).toContain('overflow-x-auto')
    expect(source).not.toContain('TabsList className="justify-center"')
  })

  test("beş adım baştan tamamı görünür TabsTrigger olarak render edilir (BAK-137)", () => {
    expect(source).toContain('<TabsTrigger key={step.id} value={step.id}>')
    expect(source).toContain('{steps.map((step, i) => (')
    // Üst seviye adım gezinmesi artık WizardStepper (yalnız geçmiş adımlara
    // dönüşe izin veren bileşik rayı) değil, hepsi baştan tıklanabilir Tabs.
    expect(source).not.toContain("WizardStepper")
  })

  test("kilitli iş emrinde bile adımlar arasında serbestçe gezinilebilir (BAK-137)", () => {
    // currentStep artık `locked` durumunda "finish"e zorlanmıyor — kilit
    // yalnız düzenlemeyi durdurur, sekme değiştirmeyi değil.
    expect(source).not.toMatch(/currentStep: StepId = locked\s*\n\s*\? "finish"/)
    expect(source).toContain('const currentStep: StepId = validRequestedStep ?? rememberedStep ?? derivedStep')
    expect(source).toContain('<Tabs value={currentStep} onValueChange={(value) => isStepId(String(value)) && goToStep(value as StepId)}>')
  })

  test("kilitli iş emrini tek uyarıyla salt okunur gösterir", () => {
    expect(source).toContain("Bu iş emri salt okunur")
    expect(source).toContain("Bilgiler değiştirilemez; adımları inceleyebilirsiniz.")
    expect(source).toContain("!locked && <TechnicianPhotoUpload")
    expect(source).toContain("!locked && <AddInternalNoteForm")
  })

  test("işi tamamlamadan önce onay ister", () => {
    expect(source).toContain("setCompleteDialogOpen(true)")
    expect(source).toContain("İş tamamlandı olarak işaretlensin mi?")
    expect(source).toContain("Bu işlem iş emrini kilitler.")
  })

  test("rota BrandSpinner yükleme ve eyleme dönük hata durumları taşır", () => {
    expect(readFileSync(join(routeDir, "loading.tsx"), "utf8")).toContain("PageLoading")
    const errorSource = readFileSync(join(routeDir, "error.tsx"), "utf8")
    expect(errorSource).toContain("İş emri açılamadı")
    expect(errorSource).toContain("Tekrar dene")
  })
})
