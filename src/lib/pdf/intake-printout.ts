import { PHOTO_PHASES } from "@/lib/constants"
import { formatTRY, formatMileage } from "@/lib/format"
import { fuelGaugeSvgMarkup, formatFuelLevel } from "@/lib/fuel-level"
import type { sanitizeIntakeForPublic } from "@/lib/intake/data-safety"
import { bakimxPdfFooterBar } from "@/lib/pdf/brand-footer"
import { renderWorkshopContactHtml } from "@/lib/pdf/workshop-contact"
import { escapeHtml } from "@/lib/html-escape"
import { calculateOrderTotals, formatTaxRate } from "@/lib/totals"
import type { WorkshopPublicContact } from "@/lib/workshop-contact"

export const DEFAULT_PRIMARY_COLOR = "#0B1F3A"
export const DEFAULT_ACCENT_COLOR = "#2563EB"

/**
 * Branding colors reach this template from workshop settings. They are written
 * into a `<style>` block, where `escapeHtml` would NOT stop a `</style>`
 * breakout — so anything that is not a plain hex color falls back to the
 * default. (Settings validation already enforces `#rrggbb`; this is the second
 * line of defence for legacy rows.)
 */
export function safeHexColor(value: string | null | undefined, fallback: string): string {
  return value && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : fallback
}

type IntakePrintoutData = {
  workshop: { name: string; phone: string; city: string; address: string; logoUrl?: string | null }
  intakeForm: ReturnType<typeof sanitizeIntakeForPublic>
  branding?: { pdfLogoUrl: string | null; themeColor: string | null; accentColor: string | null }
  /** Atölyenin müşteriye gösterdiği iletişim / sosyal medya bilgileri (#173). */
  contact?: WorkshopPublicContact | null
  customTemplate?: string | null
  createdAt: Date
  photoCompletion: {
    percentage: number
    requiredCompleted: number
    required: number
    total: number
    completed: number
    missingLabels: string[]
  }
}

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("tr-TR")

const lineTotalOf = (item: { quantity: number; unitPrice: number | null; totalPrice: number | null }) => {
  if (item.totalPrice != null && item.totalPrice > 0) return item.totalPrice
  if (item.unitPrice != null && item.unitPrice > 0) return Math.round(item.unitPrice * item.quantity)
  return null
}

/**
 * Bir kalem grubunu (parça / işçilik / dış işçilik) tabloya çevirir.
 *
 * `showAmounts` false ise "Tutar" sütunu hiç basılmaz. Baştan sona "—" dolu bir
 * fiyat sütunu, fiyatın bozuk geldiği izlenimi veriyordu; tutar bilgisi yoksa
 * sütunu göstermemek daha dürüst.
 */
function itemsTable(
  title: string,
  items: { name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[],
  toneClass: string,
  showAmounts: boolean
): string {
  if (items.length === 0) return ""
  const rows = items
    .map((item) => {
      const total = lineTotalOf(item)
      return `<tr>
        <td class="cell cell-name">${item.name}</td>
        <td class="cell cell-center">${item.quantity}</td>
        ${showAmounts ? `<td class="cell cell-amount">${total != null ? formatTRY(total) : "—"}</td>` : ""}
      </tr>`
    })
    .join("")
  return `<div class="items-group">
    <div class="items-group-title ${toneClass}">${title}</div>
    <table class="table">
      <thead>
        <tr>
          <th class="th">Kalem</th>
          <th class="th th-center">Adet</th>
          ${showAmounts ? `<th class="th th-amount">Tutar</th>` : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
}

function section(title: string, body: string, meta = ""): string {
  return `<section class="section">
    <h2 class="section-title">${title}${meta ? `<span class="section-meta">${meta}</span>` : ""}</h2>
    <div class="card">${body}</div>
  </section>`
}

/**
 * Müşteriyle paylaşılan araç kabul / iş emri çıktısının HTML'i.
 *
 * Tek bir belge iki bağlamda kullanılıyor: ekranda A4 önizlemesi (gri zemin
 * üzerinde sayfa görünümü + yazdırma çubuğu) ve yazıcı/PDF çıktısı. Ekran
 * genişliğinden bağımsız olarak içerik hep A4 metin sütununda kalır, böylece
 * ekranda görülen ile kâğıda basılan aynı olur.
 */
export function renderIntakePrintoutHtml(data: IntakePrintoutData): string {
  const { workshop, intakeForm, branding, contact, customTemplate, createdAt, photoCompletion } = data
  const primaryColor = safeHexColor(branding?.themeColor, DEFAULT_PRIMARY_COLOR)
  const accentColor = safeHexColor(branding?.accentColor, DEFAULT_ACCENT_COLOR)
  const logoUrl = branding?.pdfLogoUrl || workshop.logoUrl

  // Escape workshop-controlled text interpolated into the raw HTML below.
  // (intakeForm fields are already escaped via escapeIntakeForHtml.)
  const safeWorkshopName = escapeHtml(workshop.name)
  const safeWorkshopCity = escapeHtml(workshop.city)
  const safeWorkshopAddress = escapeHtml(workshop.address)
  const safeWorkshopPhone = escapeHtml(workshop.phone)
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : logoUrl
  const safeCustomTemplate = customTemplate ? escapeHtml(customTemplate) : customTemplate

  const statusLabel = intakeForm.statusLabel || intakeForm.status
  const customerName =
    intakeForm.customer.type === "corporate"
      ? intakeForm.customer.companyName || "Kurumsal Müşteri"
      : intakeForm.customer.fullName ||
        `${intakeForm.customer.firstName ?? ""} ${intakeForm.customer.lastName ?? ""}`.trim() ||
        "Müşteri"

  const orderItems = intakeForm.order?.items ?? []
  const parts = orderItems.filter((i) => i.type === "part")
  const labor = orderItems.filter((i) => i.type === "labor")
  const externalLabor = orderItems.filter((i) => i.type === "external_labor")
  // Toplamlar tek yerden (totals.ts) gelir: indirim KDV'ye tabi kısma orantılı
  // dağıtılır ve KDV yalnız `includeVat` satırlara uygulanır. Elle satır toplayan
  // eski hesap iş emrinin indirimini ve KDV'sini komple düşürüyordu.
  const orderTotals = calculateOrderTotals(orderItems, {
    discountAmount: intakeForm.order?.discountAmount ?? null,
    taxRate: intakeForm.order?.taxRate ?? null,
  })
  const partsTotal = orderTotals.partsTotal
  const laborTotal = orderTotals.laborTotal
  const externalLaborTotal = orderTotals.externalLaborTotal
  const grandTotal = orderTotals.grandTotal

  const approval = intakeForm.approvals[0]
  const isApproved = approval?.status === "verified"

  // ---- Kanıt özeti -------------------------------------------------------
  const photoTone =
    photoCompletion.percentage === 100 ? "ok" : photoCompletion.percentage >= 60 ? "warn" : "bad"
  const summaryCells = [
    {
      tone: photoTone,
      value: `%${photoCompletion.percentage}`,
      label: "Fotoğraf kanıtı",
      hint: `${photoCompletion.requiredCompleted}/${photoCompletion.required} zorunlu kare`,
    },
    {
      tone: intakeForm.damageMarks.length > 0 ? "warn" : "ok",
      value: String(intakeForm.damageMarks.length),
      label: "Hasar kaydı",
      hint: intakeForm.damageMarks.length > 0 ? "Detaylar aşağıda" : "Kayıt yok",
    },
    {
      tone: isApproved ? "ok" : "warn",
      value: isApproved ? "Onaylı" : "Bekliyor",
      label: "Müşteri onayı",
      hint: approval?.approvedAt ? fmtDate(approval.approvedAt) : "Onay tarihi yok",
    },
  ]
    .map(
      (cell) => `<div class="stat">
        <div class="stat-value tone-${cell.tone}">${cell.value}</div>
        <div class="stat-label">${cell.label}</div>
        <div class="stat-hint">${cell.hint}</div>
      </div>`
    )
    .join("")

  const evidenceSummarySection = section("Kanıt Özeti", `<div class="stats">${summaryCells}</div>`)

  // ---- Müşteri & araç ----------------------------------------------------
  const vehicleLines = [
    `<div class="field-sub">${intakeForm.vehicle.brand} ${intakeForm.vehicle.model}${
      intakeForm.vehicle.modelYear ? ` • ${intakeForm.vehicle.modelYear}` : ""
    }</div>`,
    intakeForm.mileageAtIntake != null
      ? `<div class="field-sub">Kilometre: ${formatMileage(intakeForm.mileageAtIntake)}</div>`
      : "",
    intakeForm.fuelLevelAtIntake != null
      ? `<div class="field-sub fuel">${fuelGaugeSvgMarkup(intakeForm.fuelLevelAtIntake, 44)}<span>Kabulde yakıt: ${formatFuelLevel(
          intakeForm.fuelLevelAtIntake
        )}</span></div>`
      : "",
    intakeForm.vehicle.vin ? `<div class="field-mono">VIN ${intakeForm.vehicle.vin}</div>` : "",
  ].join("")

  const partiesSection = section(
    "Müşteri &amp; Araç",
    `<div class="cols">
      <div class="col">
        <div class="field-label">Müşteri</div>
        <div class="field-value">${customerName}</div>
        <div class="field-sub">Tel: ${intakeForm.customer.phone}</div>
      </div>
      <div class="col">
        <div class="field-label">Araç</div>
        <div class="field-value">${intakeForm.vehicle.plate}</div>
        ${vehicleLines}
      </div>
    </div>`
  )

  // ---- Kabul detayı ------------------------------------------------------
  const intakeDetailSection = section(
    "Kabul Detayı",
    `<div class="field-label">Müşteri şikayeti</div>
     <div class="complaint">${intakeForm.customerComplaint}</div>
     <div class="meta-row">
       <span>Kayıt: ${fmtDate(intakeForm.createdAt)}</span>
       ${intakeForm.approvedAt ? `<span>Onay: ${fmtDate(intakeForm.approvedAt)}</span>` : ""}
     </div>`
  )

  // ---- Servis emri -------------------------------------------------------
  const hasMoney = partsTotal > 0 || laborTotal > 0 || externalLaborTotal > 0
  const hasDiscount = orderTotals.discountAmount > 0
  const hasTax = orderTotals.taxAmount > 0
  const totalsBlock = hasMoney
    ? `<div class="totals">
        ${partsTotal > 0 ? `<div class="total-row"><span>Parça toplamı</span><span>${formatTRY(partsTotal)}</span></div>` : ""}
        ${laborTotal > 0 ? `<div class="total-row"><span>İşçilik toplamı</span><span>${formatTRY(laborTotal)}</span></div>` : ""}
        ${externalLaborTotal > 0 ? `<div class="total-row"><span>Dış işçilik toplamı</span><span>${formatTRY(externalLaborTotal)}</span></div>` : ""}
        ${hasDiscount || hasTax ? `<div class="total-row"><span>Ara toplam</span><span>${formatTRY(orderTotals.subtotal)}</span></div>` : ""}
        ${hasDiscount ? `<div class="total-row"><span>İndirim</span><span>&minus;${formatTRY(orderTotals.discountAmount)}</span></div>` : ""}
        ${hasTax ? `<div class="total-row"><span>KDV (${formatTaxRate(orderTotals.taxRate)})</span><span>${formatTRY(orderTotals.taxAmount)}</span></div>` : ""}
        <div class="total-row total-grand"><span>Genel Toplam</span><span>${formatTRY(grandTotal)}</span></div>
      </div>`
    : ""

  // Hiçbir kalemde tutar yoksa "Tutar" sütununu hiç basma.
  const showAmounts = orderItems.some((item) => lineTotalOf(item) != null)

  const orderSection =
    intakeForm.order && orderItems.length > 0
      ? section(
          "Servis Emri",
          `${itemsTable("Parçalar", parts, "tone-accent", showAmounts)}
           ${itemsTable("İşçilik", labor, "tone-labor", showAmounts)}
           ${itemsTable("Dış İşçilik", externalLabor, "tone-labor", showAmounts)}
           ${totalsBlock}
           ${intakeForm.order.paymentStatusLabel ? `<div class="meta-row"><span>Ödeme durumu: ${intakeForm.order.paymentStatusLabel}</span></div>` : ""}`,
          `${orderItems.length} kalem`
        )
      : ""

  // ---- Hasar -------------------------------------------------------------
  const damageSection =
    intakeForm.damageMarks.length > 0
      ? section(
          "Hasar Kayıtları",
          `<table class="table">
            <thead>
              <tr>
                <th class="th">Bölge</th>
                <th class="th">Tip</th>
                <th class="th">Şiddet</th>
                <th class="th">Not</th>
              </tr>
            </thead>
            <tbody>
              ${intakeForm.damageMarks
                .map(
                  (mark) => `<tr>
                    <td class="cell cell-name"><span class="dot" style="background:${safeHexColor(
                      mark.severityColor,
                      "#9CA3AF"
                    )}"></span>${mark.zoneLabel || mark.zone}</td>
                    <td class="cell">${mark.damageTypeLabel || mark.damageType}</td>
                    <td class="cell">${mark.severityLabel || mark.severity}</td>
                    <td class="cell cell-muted">${mark.note || "—"}</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>`,
          `${intakeForm.damageMarks.length} kayıt`
        )
      : ""

  // ---- Fotoğraf kontrol listesi -----------------------------------------
  const photoSection =
    intakeForm.photos.length > 0
      ? section(
          "Fotoğraf Kontrol Listesi",
          `<ul class="checklist">
            ${intakeForm.photos
              .map(
                (photo) => `<li class="checklist-item">
                  <span class="check">✓</span>
                  <span class="checklist-label">${photo.label}</span>
                  <span class="chip">${
                    PHOTO_PHASES[photo.phase as keyof typeof PHOTO_PHASES]?.label || photo.phase
                  }</span>
                </li>`
              )
              .join("")}
          </ul>
          ${
            photoCompletion.missingLabels.length > 0
              ? `<div class="note-warn">Eksik zorunlu kareler: ${escapeHtml(photoCompletion.missingLabels.join(", "))}</div>`
              : ""
          }`,
          `${intakeForm.photos.length} kare`
        )
      : ""


  const approvalSection =
    intakeForm.approvals.length > 0
      ? section(
          "Onay Durumu",
          `<div class="approval ${isApproved ? "tone-ok" : "tone-warn"}">
            ${isApproved ? "✓ Müşteri onayı verildi" : "⏳ Onay bekliyor"}
          </div>
          ${approval?.approvedAt ? `<div class="meta-row"><span>Onay tarihi: ${fmtDate(approval.approvedAt)}</span></div>` : ""}`
        )
      : ""

  const customTemplateSection = customTemplate
    ? section("Özel Notlar", `<div class="complaint">${safeCustomTemplate}</div>`)
    : ""

  const workshopSection = section(
    "İş Yeri Bilgileri",
    `<div class="field-value">${safeWorkshopName}</div>
     <div class="field-sub">${safeWorkshopCity}, ${safeWorkshopAddress}</div>
     <div class="field-sub">Tel: ${safeWorkshopPhone}</div>
     ${renderWorkshopContactHtml(contact, { fontSize: "10.5px" })}`
  )

  const documentTitle = `${intakeForm.vehicle.plate} • Araç Kabul ve İşlem Özeti`

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${documentTitle} — ${safeWorkshopName}</title>
  <style>
    :root {
      --primary: ${primaryColor};
      --accent: ${accentColor};
      --ink: #14181f;
      --muted: #5b6472;
      --faint: #8b95a5;
      --line: #e3e8ef;
      --line-soft: #f1f4f9;
      --surface: #ffffff;
      --ok: #047857;
      --warn: #b45309;
      --bad: #b91c1c;
    }
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      padding: 0 0 32px;
      background: #eef1f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.55;
      color: var(--ink);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Ekran: yazdırma çubuğu (kâğıda basılmaz) */
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 10px 16px;
      background: var(--primary);
      color: #fff;
      box-shadow: 0 1px 3px rgba(11, 31, 58, .25);
    }
    .toolbar-hint { font-size: 12px; opacity: .8; margin-right: auto; }
    .toolbar-actions { display: flex; gap: 8px; }
    .btn {
      font: inherit;
      font-weight: 600;
      font-size: 12px;
      padding: 7px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, .35);
      background: transparent;
      color: #fff;
      cursor: pointer;
    }
    .btn-primary { background: #fff; color: var(--primary); border-color: #fff; }

    /* A4 sayfa gövdesi — ekranda da kâğıttaki metin sütunuyla aynı genişlik */
    .sheet {
      width: 210mm;
      max-width: 100%;
      margin: 20px auto 0;
      padding: 14mm;
      background: var(--surface);
      box-shadow: 0 6px 24px rgba(15, 23, 42, .12);
    }

    /* Başlık */
    .doc-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 10px;
      border-bottom: 3px solid var(--primary);
      margin-bottom: 16px;
    }
    .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .brand img { height: 34px; width: auto; max-width: 130px; object-fit: contain; }
    .doc-title { font-size: 19px; font-weight: 700; color: var(--primary); margin: 0; line-height: 1.2; }
    .doc-subtitle { font-size: 11px; color: var(--muted); margin: 2px 0 0; }
    .doc-head-right { text-align: right; flex-shrink: 0; }
    .plate {
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .5px;
      border: 1.5px solid var(--primary);
      border-radius: 4px;
      padding: 1px 8px;
      color: var(--primary);
    }
    .status-pill {
      display: inline-block;
      margin-top: 6px;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 8%, #fff);
      border: 1px solid color-mix(in srgb, var(--primary) 30%, #fff);
      color: var(--primary);
    }
    .doc-date { font-size: 10px; color: var(--muted); margin-top: 4px; }

    /* Bölümler */
    .section { margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
    .section-title {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      font-size: 10px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 6px;
    }
    .section-meta { font-size: 9px; font-weight: 500; color: var(--faint); letter-spacing: .3px; text-transform: none; }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; background: var(--surface); }

    /* Kanıt özeti */
    .stats { display: flex; }
    .stat { flex: 1; text-align: center; padding: 0 8px; }
    .stat + .stat { border-left: 1px solid var(--line-soft); }
    .stat-value { font-size: 20px; font-weight: 700; line-height: 1.2; }
    .stat-label { font-size: 10px; color: var(--muted); margin-top: 2px; }
    .stat-hint { font-size: 9px; color: var(--faint); }
    .tone-ok { color: var(--ok); }
    .tone-warn { color: var(--warn); }
    .tone-bad { color: var(--bad); }

    /* Alan / kolon düzeni */
    .cols { display: flex; gap: 24px; }
    .col { flex: 1; min-width: 0; }
    .field-label { font-size: 10px; color: var(--muted); }
    .field-value { font-size: 13px; font-weight: 700; }
    .field-sub { font-size: 10.5px; color: var(--muted); }
    .field-mono { font-size: 9.5px; color: var(--faint); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .3px; }
    .fuel { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
    .complaint { white-space: pre-wrap; margin-top: 2px; font-size: 12.5px; }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--line-soft);
      font-size: 9.5px;
      color: var(--faint);
    }

    /* Tablolar */
    .table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    .th {
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: var(--muted);
      padding: 5px 8px;
      background: #f7f9fc;
      border-bottom: 1px solid var(--line);
    }
    .th-center { text-align: center; }
    .th-amount { text-align: right; }
    .cell { padding: 5px 8px; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
    .cell-name { font-weight: 600; }
    .cell-center { text-align: center; }
    .cell-amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .cell-muted { color: var(--faint); }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }

    .items-group + .items-group { margin-top: 10px; }
    .items-group-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 3px; }
    .tone-accent { color: var(--accent); }
    .tone-labor { color: #6d28d9; }

    /* Toplamlar */
    .totals { margin-top: 10px; padding-top: 8px; border-top: 2px solid var(--primary); }
    .total-row { display: flex; justify-content: space-between; gap: 16px; font-size: 10.5px; color: var(--muted); }
    .total-row span:last-child { font-variant-numeric: tabular-nums; }
    .total-grand { margin-top: 5px; font-size: 13px; font-weight: 700; color: var(--ink); }

    /* Fotoğraf kontrol listesi */
    .checklist { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
    .checklist-item { display: flex; align-items: center; gap: 6px; font-size: 10.5px; padding: 2px 0; }
    .check { color: var(--ok); font-weight: 700; }
    .checklist-label { flex: 1; min-width: 0; }
    .chip {
      font-size: 8.5px;
      color: var(--muted);
      background: var(--line-soft);
      border-radius: 999px;
      padding: 1px 7px;
      white-space: nowrap;
    }
    .note-warn {
      margin-top: 8px;
      font-size: 9.5px;
      color: var(--warn);
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 5px 8px;
    }


    .approval { font-size: 12px; font-weight: 700; }

    .disclaimer {
      margin-top: 14px;
      padding: 8px 10px;
      border: 1px solid #dbeafe;
      border-radius: 6px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 9px;
      text-align: center;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .sheet { width: auto; max-width: none; margin: 0; padding: 0; box-shadow: none; }
      .no-print { display: none !important; }
      .section { break-inside: avoid; page-break-inside: avoid; }
      .table { break-inside: auto; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      thead { display: table-header-group; }
    }

    @media screen and (max-width: 760px) {
      .sheet { margin-top: 12px; padding: 18px 16px; }
      .cols { flex-direction: column; gap: 12px; }
      .checklist { grid-template-columns: 1fr; }
      .doc-head { flex-direction: column; }
      .doc-head-right { text-align: left; }
      .toolbar-hint { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <span class="toolbar-hint">Bu sayfa yazdırılmak veya PDF olarak kaydedilmek üzere hazırlandı.</span>
    <div class="toolbar-actions">
      <button type="button" class="btn btn-primary" onclick="window.print()">Yazdır / PDF kaydet</button>
      <button type="button" class="btn" id="printout-close" hidden onclick="window.close()">Kapat</button>
    </div>
  </div>
  <script>
    // window.close() yalnızca sekme script'le ya da yeni sekme olarak açıldıysa
    // çalışır; aksi halde tarayıcı sessizce yok sayar. Ölü buton göstermemek
    // için düğmeyi sadece kapatılabilir sekmelerde açıyoruz.
    (function () {
      if (window.opener || window.history.length <= 1) {
        document.getElementById("printout-close").hidden = false
      }
    })()
  </script>

  <main class="sheet">
    <header class="doc-head">
      <div class="brand">
        ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="" />` : ""}
        <div>
          <h1 class="doc-title">${safeWorkshopName}</h1>
          <p class="doc-subtitle">Araç Kabul ve İşlem Özeti</p>
        </div>
      </div>
      <div class="doc-head-right">
        <span class="plate">${intakeForm.vehicle.plate}</span>
        <div><span class="status-pill">${statusLabel}</span></div>
        <div class="doc-date">${fmtDate(intakeForm.createdAt)}</div>
      </div>
    </header>

    ${partiesSection}
    ${intakeDetailSection}
    ${orderSection}
    ${evidenceSummarySection}
    ${damageSection}
    ${photoSection}
    ${approvalSection}
    ${customTemplateSection}
    ${workshopSection}

    <div class="disclaimer">
      Bu sayfa yalnızca yetkili kişilerle paylaşım içindir. İç notlar, OCR verileri ve iş yeri iç kimlik bilgileri bu sayfada gösterilmez.
    </div>

    ${bakimxPdfFooterBar(createdAt)}
  </main>
</body>
</html>`
}
