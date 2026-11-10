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
