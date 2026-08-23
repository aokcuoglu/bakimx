import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "technician-order-detail.tsx"), "utf8")
const partsSectionSource = readFileSync(join(import.meta.dir, "technician-parts-labor-section.tsx"), "utf8")
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
    expect(source).toContain('<TabsTrigger key={step.id} value={step.id}')
    expect(source).toContain('{steps.map((step) => {')
    // Üst seviye adım gezinmesi artık WizardStepper (yalnız geçmiş adımlara
    // dönüşe izin veren bileşik rayı) değil, hepsi baştan tıklanabilir Tabs.
    expect(source).not.toContain("WizardStepper")
  })

  test("ofis iş emriyle aynı ikonlu çizgi sekme ve ortak durum rozeti desenini kullanır", () => {
    expect(source).toContain('<TabsList variant="line"')
    expect(source).toContain('<Icon className="size-4" />')
    expect(source).toContain('<StatusBadge status={order.status} />')
  })

  test("kilitli iş emrinde bile adımlar arasında serbestçe gezinilebilir (BAK-137)", () => {
    // currentStep artık `locked` durumunda "finish"e zorlanmıyor — kilit
    // yalnız düzenlemeyi durdurur, sekme değiştirmeyi değil.
    expect(source).not.toMatch(/currentStep: StepId = locked\s*\n\s*\? "finish"/)
    expect(source).toContain('const currentStep: StepId = validRequestedStep ?? rememberedStep ?? derivedStep')
    // BAK-154: Radix `onValueChange` doğrudan `string` verir — Base UI'nin
    // `String(value)` / `value as StepId` sarmalayıcıları kalktı, kural aynı.
    expect(source).toContain('<Tabs value={currentStep} onValueChange={(value) => isStepId(value) && goToStep(value)}>')
  })

  test("beklemeye al/devam et hızlı aksiyonları adım içeriğinden bağımsız, üstte durur (BAK-148)", () => {
    const quickActionsIndex = source.indexOf("(canHold || canStart) &&")
    const tabsNavIndex = source.indexOf("<Tabs value={currentStep}")
    expect(quickActionsIndex).toBeGreaterThan(-1)
    expect(quickActionsIndex).toBeLessThan(tabsNavIndex)

    // Her iki metin de tam olarak BİR yerde geçer — adım içeriğinde
    // (ör. "start"/"finish" TabsContent) tekrarlanan bir kopyası kalmamalı.
    expect(source.split("Beklemeye al").length - 1).toBe(1)
    expect(source.split('"Tamire devam et"').length - 1).toBe(1)
  })

  test("üst aksiyonları İş Emri ile tek, taşabilen mobil satırda toplar", () => {
    expect(source).toContain('flex-nowrap items-center gap-2 overflow-x-auto')
    expect(source).toContain('sm:w-auto sm:justify-end')
    expect(source).toContain('<FileText />')
  })

  test("sekme geçişinde ortak sayfa yükleme durumunu gösterir ve adım başlığını tekrar etmez", () => {
    expect(source).toContain('import { PageLoading } from "@/components/shared/page-loading"')
    expect(source).toContain('{isStepPending ? <PageLoading /> : <>')
    expect(source).toContain('startStepTransition(() => {')
    expect(source).not.toContain("WizardHeading")
  })

  test("iş emri adımlarındaki kart yüzeylerini ortak hafif primary tonu ile tutarlı kılar", () => {
    expect(source).toContain('bg-primary/[0.04]')
    expect(partsSectionSource).toContain('section className="relative rounded-xl border border-border bg-primary/[0.04]')
  })

  test("ileri/geri aksiyonlarını küçük ve sabit alt çubukta tutar", () => {
    expect(source).toContain("<WizardActions sticky")
    expect(source).toContain('size="sm" onClick={() => goToStep("needs")}')
    const wizardUi = readFileSync(join(import.meta.dir, "../intake/wizard-ui.tsx"), "utf8")
    expect(wizardUi).toContain("fixed inset-x-0 bottom-16")
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

describe("talep akışının sökülmesi", () => {
  test("Talepler sekmesi ve PartsRequestSection kaldırıldı", () => {
    expect(source).not.toContain('value="requests"')
    expect(source).not.toContain("PartsRequestSection")
  })

  test("dış işçilik artık gerçek iş emri kalemi, grid'den süzülüyor", () => {
    expect(source).toMatch(/type !== "external_labor"/)
    expect(source).toContain("externalLaborItems")
  })

  test("parça & işçilik grid'i dış işçilik modunu kapatıyor", () => {
    expect(partsSectionSource).toContain("allowExternalLabor={false}")
  })

  test("dış alımlar sekmesinde dış işçilik ekleme butonu var", () => {
    expect(source).toContain("AddExternalLaborButton")
    expect(source).toContain("AddPurchaseCardButton")
  })

  test("karar bekleyen eski talepler için salt-okunur uyarı gösterilir", () => {
    expect(source).toContain("findUndecidedPartsRequests")
    expect(source).toContain("undecidedRequestNames")
  })
})
