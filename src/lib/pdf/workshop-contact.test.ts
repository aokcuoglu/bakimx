import { expect, test, describe } from "bun:test"
import { renderWorkshopContactHtml } from "./workshop-contact"

describe("renderWorkshopContactHtml", () => {
  test("dolu alanları etiket + bağlantı olarak basar", () => {
    const html = renderWorkshopContactHtml({
      publicWhatsappNumber: "5445157408",
      faxNumber: "2121112244",
      instagramUrl: "https://instagram.com/kizildagoto",
    })

    expect(html).toContain("WhatsApp: ")
    expect(html).toContain('href="https://wa.me/905445157408"')
    expect(html).toContain("0544 515 74 08")
    expect(html).toContain("Faks: ")
    expect(html).toContain("0212 111 22 44")
    expect(html).toContain('href="https://instagram.com/kizildagoto"')
    expect(html).toContain("instagram.com/kizildagoto")
  })

  test("hiçbir alan dolu değilse boş string döner — kutu/çizgi kalmaz", () => {
    expect(renderWorkshopContactHtml(null)).toBe("")
    expect(renderWorkshopContactHtml(undefined)).toBe("")
    expect(renderWorkshopContactHtml({})).toBe("")
    expect(renderWorkshopContactHtml({ instagramUrl: "", secondaryPhone: "   " })).toBe("")
  })

  test("boş alan satır açmaz — yalnızca dolu olan basılır", () => {
    const html = renderWorkshopContactHtml({ secondaryPhone: "2121112233", youtubeUrl: null })
    expect(html).toContain("Telefon 2: ")
    expect(html).not.toContain("YouTube")
    expect(html).not.toContain("WhatsApp")
    expect(html).not.toContain("Faks")
  })

  test("HTML/attribute breakout denemesi ham olarak basılmaz", () => {
    // Kaydedilirken elenmiş olsa da eski/bozuk satırlar bu fonksiyona ulaşabilir.
    // URL normalizasyonu tırnak ve açılı parantezleri yüzde-kodlar, escapeHtml de
    // ikinci savunma hattı olarak durur.
    const html = renderWorkshopContactHtml({
      instagramUrl: 'https://instagram.com/"><script>alert(1)</script>',
    })
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("alert(1)</")
    expect(html).toContain("%22%3E%3Cscript%3E")
  })

  test("geçersiz şemalı adres hiç render edilmez", () => {
    expect(renderWorkshopContactHtml({ facebookUrl: "javascript:alert(1)" })).toBe("")
  })
})
