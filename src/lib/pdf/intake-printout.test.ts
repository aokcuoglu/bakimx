import { expect, test, describe } from "bun:test"
import { renderIntakePrintoutHtml, safeHexColor, DEFAULT_PRIMARY_COLOR } from "./intake-printout"
import { sanitizeIntakeForPublic, escapeIntakeForHtml } from "@/lib/intake/data-safety"
import type { WorkshopPublicContact } from "@/lib/workshop-contact"

const CREATED_AT = new Date("2026-07-05T08:59:00.000Z")

function buildIntake(overrides: Record<string, unknown> = {}) {
  return escapeIntakeForHtml(
    sanitizeIntakeForPublic(
      {
        status: "in_progress",
        mileageAtIntake: 45500,
        fuelLevelAtIntake: null,
        customerComplaint: "YAĞ KAÇIRIYOR",
        approvedAt: null,
        createdAt: CREATED_AT,
        customer: {
          firstName: null,
          lastName: null,
          fullName: null,
          companyName: "Rent go",
          contactName: null,
          type: "corporate",
          phone: "5358355775",
        },
        vehicle: {
          plate: "34MSZ830",
          brand: "OPEL",
          model: "CORSA F (P2JO)",
          modelYear: 2025,
          mileage: 45500,
          vin: "VXKUPHNK2R4356846",
        },
        photos: [{ id: "p1", type: "damage_detail", label: "Hasar detayı", fileUrl: null, phase: "intake" }],
        damageMarks: [],
        approvals: [],
        order: null,
        ...overrides,
      },
      { showPhotos: true, showDamage: true, showOrderItems: true, showPaymentStatus: true }
    )
  )
}

function render(
  overrides: Record<string, unknown> = {},
  branding?: { pdfLogoUrl: string | null; themeColor: string | null; accentColor: string | null },
  contact?: WorkshopPublicContact | null
) {
  return renderIntakePrintoutHtml({
    workshop: { name: "KIZILDAĞ OTO", phone: "02121112233", city: "İstanbul", address: "Sanayi Sitesi 1", logoUrl: null },
    intakeForm: buildIntake(overrides),
    branding,
    contact,
    customTemplate: null,
    createdAt: CREATED_AT,
    photoCompletion: { percentage: 0, requiredCompleted: 0, required: 8, total: 12, completed: 1, missingLabels: ["Ön sol"] },
  })
}

describe("safeHexColor", () => {
  test("hex değerleri geçirir, diğer her şeyi varsayılana düşürür", () => {
    expect(safeHexColor("#123abc", DEFAULT_PRIMARY_COLOR)).toBe("#123abc")
    expect(safeHexColor("#abc", DEFAULT_PRIMARY_COLOR)).toBe("#abc")
    expect(safeHexColor(null, DEFAULT_PRIMARY_COLOR)).toBe(DEFAULT_PRIMARY_COLOR)
    expect(safeHexColor("", DEFAULT_PRIMARY_COLOR)).toBe(DEFAULT_PRIMARY_COLOR)
    // <style> bloğuna yazıldığı için escapeHtml burada yetmez — reddedilmeli.
    expect(safeHexColor("red;}</style><script>x()</script>", DEFAULT_PRIMARY_COLOR)).toBe(DEFAULT_PRIMARY_COLOR)
  })
})

describe("renderIntakePrintoutHtml", () => {
  test("belge kabuğu: dil, başlık ve A4 sayfa yapısı", () => {
    const html = render()
    expect(html).toContain('<html lang="tr">')
    expect(html).toContain("<title>34MSZ830 • Araç Kabul ve İşlem Özeti — KIZILDAĞ OTO</title>")
    expect(html).toContain("@page { size: A4; margin: 14mm; }")
    expect(html).toContain('<main class="sheet">')
  })

  test("yazdırma çubuğu ekranda var, kâğıtta gizli", () => {
    const html = render()
    expect(html).toContain('onclick="window.print()"')
    expect(html).toContain('class="toolbar no-print"')
    expect(html).toContain(".no-print { display: none !important; }")
  })

  test("Kapat butonu varsayılan gizli — yalnızca kapatılabilir sekmede açılır", () => {
    const html = render()
    expect(html).toContain('id="printout-close" hidden')
    expect(html).toContain("window.opener || window.history.length <= 1")
  })

  test("arka plan renkleri yazdırmada korunur ve bölümler sayfa ortasından bölünmez", () => {
    const html = render()
    expect(html).toContain("print-color-adjust: exact")
    expect(html).toContain("page-break-inside: avoid")
    expect(html).toContain("display: table-header-group")
  })

  test("fotoğraf fazı ham enum yerine Türkçe etiketle yazılır", () => {
    const html = render()
    expect(html).toContain("Kabul (Intake)")
    expect(html).not.toContain(">intake<")
  })

  test("kanıt özeti eksik zorunlu kare sayısını da gösterir", () => {
    const html = render()
    expect(html).toContain("%0")
    expect(html).toContain("0/8 zorunlu kare")
    expect(html).toContain("Eksik zorunlu kareler: Ön sol")
  })

  test("plaka ve durum başlıkta birlikte görünür", () => {
    const html = render()
    expect(html).toContain('<span class="plate">34MSZ830</span>')
    expect(html).toContain('<span class="status-pill">İşlemde</span>')
  })

  test("servis emri kalemleri ve toplamları basılır", () => {
    const html = render({
      order: {
        status: "in_progress",
        paymentStatus: "unpaid",
        items: [
          { type: "part", name: "Yağ filtresi", quantity: 2, unitPrice: 250, totalPrice: null },
          { type: "labor", name: "Yağ değişimi", quantity: 1, unitPrice: null, totalPrice: 400 },
        ],
      },
    })
    expect(html).toContain("Yağ filtresi")
    expect(html).toContain("Parça toplamı")
    expect(html).toContain("Genel Toplam")
    expect(html).toContain("2 kalem")
  })

  test("hiçbir kalemde tutar yoksa Tutar sütunu hiç basılmaz", () => {
    const html = render({
      order: {
        status: "in_progress",
        paymentStatus: "unpaid",
        items: [
          { type: "part", name: "Manuel parça", quantity: 1, unitPrice: null, totalPrice: null },
          { type: "part", name: "Filtre, kabin havası", quantity: 1, unitPrice: null, totalPrice: null },
        ],
      },
    })
    expect(html).toContain("Manuel parça")
    expect(html).not.toContain("Tutar</th>")
    // `.cell-amount` stylesheet'te tanımlı kalır; asıl kontrol hücrenin hiç
    // basılmaması.
    expect(html).not.toContain('<td class="cell cell-amount">')
  })

  test("tek bir kalemin tutarı varsa sütun kalır, fiyatsız satır — basar", () => {
    const html = render({
      order: {
        status: "in_progress",
        paymentStatus: "unpaid",
        items: [
          { type: "part", name: "Filtre, kabin havası", quantity: 1, unitPrice: 50000, totalPrice: null },
          { type: "part", name: "Manuel parça", quantity: 1, unitPrice: null, totalPrice: null },
        ],
      },
    })
    expect(html).toContain("Tutar</th>")
    expect(html).toContain("₺500,00")
    expect(html).toContain('<td class="cell cell-amount">—</td>')
  })

  test("kalem adındaki HTML kaçırılır (XSS regresyonu)", () => {
    const html = render({
      order: {
        status: "in_progress",
        paymentStatus: "unpaid",
        items: [{ type: "part", name: "<img src=x onerror=alert(1)>", quantity: 1, unitPrice: 10, totalPrice: null }],
      },
    })
    expect(html).not.toContain("<img src=x onerror=alert(1)>")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  test("marka rengi <style> bloğuna yalnızca hex olarak girer", () => {
    const html = render({}, { pdfLogoUrl: null, themeColor: "</style><script>alert(1)</script>", accentColor: "#ff0000" })
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain(`--primary: ${DEFAULT_PRIMARY_COLOR};`)
    expect(html).toContain("--accent: #ff0000;")
  })

  test("boş bölümler hiç render edilmez", () => {
    const html = render()
    expect(html).not.toContain("Hasar Kayıtları")
    expect(html).not.toContain("Servis Emri")
    expect(html).not.toContain("Süreç Zaman Çizelgesi")
  })

  test("iş yeri iletişim bilgileri adres/telefon satırının altında görünür", () => {
    const html = render({}, undefined, {
      publicWhatsappNumber: "5445157408",
      instagramUrl: "https://instagram.com/kizildagoto",
    })
    expect(html).toContain("Tel: 02121112233")
    expect(html.indexOf("WhatsApp: ")).toBeGreaterThan(html.indexOf("Tel: 02121112233"))
    expect(html).toContain('href="https://wa.me/905445157408"')
    expect(html).toContain("instagram.com/kizildagoto")
  })

  test("iletişim bilgisi girilmemişse hiçbir iz bırakmaz", () => {
    const html = render({}, undefined, { instagramUrl: "", publicWhatsappNumber: null })
    expect(html).not.toContain("WhatsApp")
    expect(html).not.toContain("Instagram")
    expect(html).not.toContain("Telefon 2")
    expect(html).not.toContain("Faks")
  })
})
