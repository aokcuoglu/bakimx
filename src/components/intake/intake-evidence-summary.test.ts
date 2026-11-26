import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { IntakeEvidenceSummary } from "./intake-evidence-summary"

test("eksik fotoğrafları erişilebilir kısayollarla ve diğer kanıt durumlarıyla gösterir", () => {
  const html = renderToStaticMarkup(createElement(IntakeEvidenceSummary, {
    photoCompletion: {
      percentage: 50,
      requiredCompleted: 1,
      required: 2,
      total: 3,
      completed: 1,
      missing: ["front"],
      missingLabels: ["Ön"],
    },
    damageCount: 2,
    approvalStatus: "pending",
    publicLinkStatus: "active",
  }))

  expect(html).toContain('role="progressbar"')
  expect(html).toContain('aria-valuenow="50"')
  expect(html).toContain('aria-label="Ön fotoğrafını ekle"')
  expect(html).toContain("2 kayıt")
  expect(html).toContain("Bekleniyor")
  expect(html).toContain("Aktif")
})

test("tamamlanan zorunlu fotoğraflarda eksik kısayolu göstermez", () => {
  const html = renderToStaticMarkup(createElement(IntakeEvidenceSummary, {
    photoCompletion: {
      percentage: 100,
      requiredCompleted: 2,
      required: 2,
      total: 3,
      completed: 2,
      missing: [],
      missingLabels: [],
    },
    damageCount: 0,
    approvalStatus: "verified",
    publicLinkStatus: "expired",
  }))

  expect(html).toContain("Tüm zorunlu açılar tamamlandı")
  expect(html).not.toContain("Eksik açıları ekleyin")
  expect(html).toContain("Onaylandı")
  expect(html).toContain("Süresi doldu")
})

// #913 — teslim edilmiş / iptal kabulde fotoğraf kartı yarım iş göstermez:
// eksik açı düğmeleri kilitli kabulde diyaloğu açamıyordu, yalnız kaydırıyordu.
// "N/6 zorunlu" çerçevesi de kapanmış kabulde eksik iş gibi okunuyordu.
const closed = (photoCount: number, approvalStatus: "none" | "pending" | "verified") =>
  renderToStaticMarkup(createElement(IntakeEvidenceSummary, {
    photoCompletion: {
      percentage: 33,
      requiredCompleted: 2,
      required: 6,
      total: 11,
      completed: 3,
      missing: ["front", "rear", "left_side", "right_side"],
      missingLabels: ["Ön", "Arka", "Sol yan", "Sağ yan"],
    },
    damageCount: 1,
    approvalStatus,
    publicLinkStatus: "active",
    onMissingPhotoClick: () => {},
    readOnly: true,
    photoCount,
  }))

test("kapanmış kabulde zorunlu sayım, yüzde, eksik açı uyarısı ve ekleme düğmesi yok", () => {
  const html = closed(5, "verified")

  expect(html).toContain("Fotoğraflar")
  expect(html).toContain("5 fotoğraf kayıtlı")
  expect(html).not.toContain("zorunlu")
  expect(html).not.toContain("Zorunlu")
  expect(html).not.toContain("2/6")
  expect(html).not.toContain("Eksik açıları ekleyin")
  expect(html).not.toContain("fotoğrafını ekle")
  expect(html).not.toContain('role="progressbar"')
  expect(html).not.toContain("33%")
  expect(html).not.toContain("<button")
  // Diğer kanıt durumları aynen görünür.
  expect(html).toContain("1 kayıt")
  expect(html).toContain("Onaylandı")
})

test("kapanmış kabulde fotoğrafsız ve onaysız durum bekliyor gibi okunmaz", () => {
  const html = closed(0, "pending")
  expect(html).toContain("Fotoğraf kaydı yok")
  expect(html).toContain("Alınmadı")
  expect(html).not.toContain("Bekleniyor")
  expect(html).not.toContain("Henüz")
})
