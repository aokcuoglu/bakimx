import { describe, expect, test } from "bun:test"
import { appointmentDayWord } from "./reminder-day"
import { renderTemplate, getDefaultTemplate, resolveTemplateContent } from "./templates"

describe("appointmentDayWord", () => {
  test("aynı Türkiye gününde bugün der", () => {
    // TR 09:00 -> TR 23:00 (aynı gün)
    expect(
      appointmentDayWord(new Date("2026-11-25T20:00:00Z"), new Date("2026-11-25T06:00:00Z")),
    ).toBe("bugün")
  })

  test("ertesi Türkiye gününde yarın der", () => {
    expect(
      appointmentDayWord(new Date("2026-11-26T08:00:00Z"), new Date("2026-11-25T10:00:00Z")),
    ).toBe("yarın")
  })

  test("Türkiye gece yarısını aşan randevu UTC'de aynı gün olsa da yarın der", () => {
    // TR 23:30 -> TR 26.11 00:30
    expect(
      appointmentDayWord(new Date("2026-11-25T21:30:00Z"), new Date("2026-11-25T20:30:00Z")),
    ).toBe("yarın")
  })

  test("pencere dışı gün göreli sözcük olarak yakında der", () => {
    expect(
      appointmentDayWord(new Date("2026-11-28T08:00:00Z"), new Date("2026-11-25T10:00:00Z")),
    ).toBe("yakında")
  })

  test("varsayılan SMS şablonu gün sözcüğünü yerleştirir", () => {
    const text = renderTemplate(getDefaultTemplate("appointment_reminder", "sms"), {
      customerName: "A",
      workshopName: "W",
      appointmentDay: "bugün",
      appointmentDate: "25.11.2026",
      appointmentTime: "23:00",
    })
    expect(text).toContain("bugün (25.11.2026 23:00)")
    expect(text).not.toContain("yarın")
  })
})

describe("resolveTemplateContent (#908)", () => {
  const legacy =
    "Sayın {customerName}, {workshopName} - yarın ({appointmentDate} {appointmentTime}) randevunuz bulunmaktadır."

  test("eski varsayılanla birebir aynı kayıt güncel varsayılana düşer", () => {
    const text = resolveTemplateContent("appointment_reminder", "sms", legacy)
    expect(text).toBe(getDefaultTemplate("appointment_reminder", "sms"))
    expect(text).toContain("{appointmentDay}")
  })

  test("kenar boşluklu eski varsayılan da güncellenir", () => {
    expect(resolveTemplateContent("appointment_reminder", "sms", `  ${legacy}\n`)).toContain("{appointmentDay}")
  })

  test("özelleştirilmiş kayda dokunulmaz", () => {
    const custom = `${legacy} Teşekkürler.`
    expect(resolveTemplateContent("appointment_reminder", "sms", custom)).toBe(custom)
  })

  test("başka anahtar/kanalda aynı metin değiştirilmez", () => {
    expect(resolveTemplateContent("appointment_reminder", "email", legacy)).toBe(legacy)
  })

  test("kayıt yoksa varsayılan döner", () => {
    expect(resolveTemplateContent("appointment_reminder", "sms", null)).toBe(
      getDefaultTemplate("appointment_reminder", "sms"),
    )
  })
})
