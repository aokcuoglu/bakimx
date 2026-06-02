import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, PHOTO_TYPES, INTAKE_STATUS } from "@/lib/constants"
import { formatTRY, formatMileage } from "@/lib/format"

export const dynamic = "force-dynamic"

async function generatePdfHtml(data: {
  workshop: { name: string; phone: string; city: string; address: string }
  intakeForm: {
    status: string
    mileageAtIntake: number | null
    customerComplaint: string
    approvedAt: Date | null
    createdAt: Date
    customer: {
      firstName: string | null
      lastName: string | null
      fullName: string | null
      companyName: string | null
      contactName: string | null
      type: string
      phone: string
    }
    vehicle: { plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null }
    photos: { type: string; label: string; fileUrl: string | null }[]
    damageMarks: { zone: string; damageType: string; severity: string; note: string | null }[]
    approvals: { status: string; approvedAt: Date | null }[]
    order: { status: string; items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[] } | null
  }
  createdAt: Date
}): Promise<string> {
  const { workshop, intakeForm, createdAt } = data
  const statusInfo = INTAKE_STATUS[intakeForm.status as keyof typeof INTAKE_STATUS]
  const orderItems = intakeForm.order?.items ?? []
  const parts = orderItems.filter((i) => i.type === "part")
  const labor = orderItems.filter((i) => i.type === "labor")

  const partsTotal = parts.reduce((sum, i) => {
    if (i.totalPrice != null && i.totalPrice > 0) return sum + i.totalPrice
    if (i.unitPrice != null && i.unitPrice > 0) return sum + i.unitPrice * i.quantity
    return sum
  }, 0)
  const laborTotal = labor.reduce((sum, i) => {
    if (i.totalPrice != null && i.totalPrice > 0) return sum + i.totalPrice
    if (i.unitPrice != null && i.unitPrice > 0) return sum + i.unitPrice * i.quantity
    return sum
  }, 0)
  const grandTotal = partsTotal + laborTotal

  const fmtDate = (d: Date) => d.toLocaleDateString("tr-TR")

  let damageRows = ""
  for (const mark of intakeForm.damageMarks) {
    const severityInfo = DAMAGE_SEVERITY[mark.severity as keyof typeof DAMAGE_SEVERITY]
    const zoneLabel = VEHICLE_ZONES[mark.zone as keyof typeof VEHICLE_ZONES] || mark.zone
    const typeLabel = DAMAGE_TYPES[mark.damageType as keyof typeof DAMAGE_TYPES]?.label || mark.damageType
    damageRows += `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${severityInfo?.color || "#9CA3AF"};margin-right:6px;vertical-align:middle;"></span>
        ${zoneLabel}
      </td>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;">${typeLabel}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;">${severityInfo?.label || mark.severity}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;color:#999;">${mark.note || "—"}</td>
    </tr>`
  }

  let photoRows = ""
  for (const photo of intakeForm.photos) {
    const label = PHOTO_TYPES[photo.type as keyof typeof PHOTO_TYPES]?.label || photo.label
    photoRows += `<div style="padding:3px 0;color:#333;">✓ ${label}</div>`
  }

  let partRows = ""
  for (const item of parts) {
    const lineTotal = item.totalPrice != null && item.totalPrice > 0
      ? formatTRY(item.totalPrice)
      : item.unitPrice != null && item.unitPrice > 0
        ? formatTRY(item.unitPrice * item.quantity)
        : "—"
    partRows += `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-weight:600;">${item.name}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${lineTotal}</td>
    </tr>`
  }

  let laborRows = ""
  for (const item of labor) {
    const lineTotal = item.totalPrice != null && item.totalPrice > 0
      ? formatTRY(item.totalPrice)
      : item.unitPrice != null && item.unitPrice > 0
        ? formatTRY(item.unitPrice * item.quantity)
        : "—"
    laborRows += `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-weight:600;">${item.name}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${lineTotal}</td>
    </tr>`
  }

  const approvalSection = intakeForm.approvals.length > 0 ? `
    <div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Onay Durumu</h3>
      <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;">
        ${intakeForm.approvals[0].status === "verified"
          ? '<span style="color:#15803D;font-weight:700;">✓ Müşteri onayı verildi</span>'
          : '<span style="color:#A16207;font-weight:700;">⏳ Onay bekliyor</span>'}
        ${intakeForm.approvals[0].approvedAt ? `<div style="font-size:9px;color:#999;margin-top:2px;">Onay tarihi: ${fmtDate(intakeForm.approvals[0].approvedAt)}</div>` : ""}
      </div>
    </div>` : ""

  const damageSection = intakeForm.damageMarks.length > 0 ? `
    <div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Hasar Kayıtları (${intakeForm.damageMarks.length})</h3>
      <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;">
        <table style="width:100%;border-collapse:collapse;font-size:9px;">
          <thead><tr style="background:#f8fafc;">
            <th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Bölge</th>
            <th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Tip</th>
            <th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Şiddet</th>
            <th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Not</th>
          </tr></thead>
          <tbody>${damageRows}</tbody>
        </table>
      </div>
    </div>` : ""

  const photoSection = intakeForm.photos.length > 0 ? `
    <div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Fotoğraf Kontrol Listesi (${intakeForm.photos.length})</h3>
      <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;">
        ${photoRows}
      </div>
    </div>` : ""

  const orderSection = intakeForm.order && orderItems.length > 0 ? `
    <div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Servis Emri</h3>
      <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;">
        ${parts.length > 0 ? `
          <div style="font-size:8px;font-weight:700;color:#2563EB;margin-bottom:4px;text-transform:uppercase;">Parçalar</div>
          <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Kalem</th>
              <th style="padding:4px 8px;text-align:center;border-bottom:1px solid #e2e8f0;">Adet</th>
              <th style="padding:4px 8px;text-align:right;border-bottom:1px solid #e2e8f0;">Tutar</th>
            </tr></thead>
            <tbody>${partRows}</tbody>
          </table>
        ` : ""}
        ${labor.length > 0 ? `
          <div style="font-size:8px;font-weight:700;color:#7C3AED;margin-bottom:4px;text-transform:uppercase;">İşçilik</div>
          <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Kalem</th>
              <th style="padding:4px 8px;text-align:center;border-bottom:1px solid #e2e8f0;">Adet</th>
              <th style="padding:4px 8px;text-align:right;border-bottom:1px solid #e2e8f0;">Tutar</th>
            </tr></thead>
            <tbody>${laborRows}</tbody>
          </table>
        ` : ""}
        ${(partsTotal > 0 || laborTotal > 0) ? `
          <div style="border-top:2px solid #0B1F3A;padding-top:6px;margin-top:4px;">
            ${partsTotal > 0 ? `<div style="display:flex;justify-content:space-between;font-size:9px;color:#666;"><span>Parça Toplamı</span><span>${formatTRY(partsTotal)}</span></div>` : ""}
            ${laborTotal > 0 ? `<div style="display:flex;justify-content:space-between;font-size:9px;color:#666;"><span>İşçilik Toplamı</span><span>${formatTRY(laborTotal)}</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-top:4px;"><span>Genel Toplam</span><span>${formatTRY(grandTotal)}</span></div>
          </div>
        ` : ""}
      </div>
    </div>` : ""

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 30px; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a1a; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0B1F3A;padding-bottom:8px;margin-bottom:16px;">
    <div>
      <h1 style="font-size:20px;font-weight:700;color:#0B1F3A;margin:0;">${workshop.name}</h1>
      <p style="font-size:10px;color:#666;margin:2px 0 0;">Araç Kabul ve İşlem Özeti</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#333;">${fmtDate(intakeForm.createdAt)}</div>
      <div style="font-size:8px;color:#999;">BakimX ile oluşturuldu</div>
    </div>
  </div>

  <div style="margin-bottom:6px;">
    <span style="font-size:9px;padding:2px 8px;border:1px solid #0B1F3A;border-radius:10px;color:#0B1F3A;">${statusInfo?.label || intakeForm.status}</span>
  </div>

  <div style="margin-bottom:12px;">
    <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Müşteri & Araç</h3>
    <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;display:flex;gap:24px;">
      <div style="flex:1;">
        <div style="font-size:10px;color:#666;">Müşteri</div>
        <div style="font-weight:700;">${
          intakeForm.customer.type === "corporate"
            ? intakeForm.customer.companyName || "Kurumsal Müşteri"
            : intakeForm.customer.fullName || `${intakeForm.customer.firstName ?? ""} ${intakeForm.customer.lastName ?? ""}`.trim() || "Müşteri"
        }</div>
        <div style="font-size:9px;color:#666;">Tel: ${intakeForm.customer.phone}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:10px;color:#666;">Araç</div>
        <div style="font-weight:700;">${intakeForm.vehicle.plate}</div>
        <div style="font-size:9px;color:#666;">${intakeForm.vehicle.brand} ${intakeForm.vehicle.model}${intakeForm.vehicle.modelYear ? ` • ${intakeForm.vehicle.modelYear}` : ""}</div>
        ${intakeForm.mileageAtIntake != null ? `<div style="font-size:9px;color:#666;">Kilometre: ${formatMileage(intakeForm.mileageAtIntake)}</div>` : ""}
        ${intakeForm.vehicle.vin ? `<div style="font-size:8px;color:#999;font-family:monospace;">VIN: ${intakeForm.vehicle.vin}</div>` : ""}
      </div>
    </div>
  </div>

  <div style="margin-bottom:12px;">
    <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Kabul Detayı</h3>
    <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;">
      <div style="font-size:9px;color:#666;">Müşteri Şikayeti</div>
      <div style="white-space:pre-wrap;margin-top:2px;">${intakeForm.customerComplaint}</div>
      <div style="display:flex;gap:12px;margin-top:6px;padding-top:6px;border-top:1px solid #f1f5f9;font-size:8px;color:#999;">
        <span>Kayıt: ${fmtDate(intakeForm.createdAt)}</span>
        ${intakeForm.approvedAt ? `<span>Onay: ${fmtDate(intakeForm.approvedAt)}</span>` : ""}
      </div>
    </div>
  </div>

  ${damageSection}
  ${photoSection}
  ${approvalSection}
  ${orderSection}

  <div style="margin-bottom:12px;">
    <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">İş Yeri Bilgileri</h3>
    <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;">
      <div style="font-weight:700;">★ ${workshop.name}</div>
      <div style="font-size:9px;color:#666;">${workshop.city}, ${workshop.address}</div>
      <div style="font-size:9px;color:#666;">Tel: ${workshop.phone}</div>
    </div>
  </div>

  <div style="text-align:center;margin-top:20px;padding-top:10px;border-top:1px solid #E5E7EB;color:#999;font-size:8px;">
    <div>Bu çıktı, servis kabul ve işlem özeti amacıyla oluşturulmuştur.</div>
    <div style="margin-top:4px;">BakimX ile oluşturuldu • ${fmtDate(createdAt)}</div>
  </div>
</body>
</html>`
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const shareLink = await prisma.publicShareLink.findUnique({
    where: { token },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          photos: { select: { type: true, label: true, fileUrl: true } },
          damageMarks: { select: { zone: true, damageType: true, severity: true, note: true } },
          approvals: { select: { status: true, approvedAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
          order: { select: { status: true, items: { select: { type: true, name: true, quantity: true, unitPrice: true, totalPrice: true } } } },
        },
      },
      workshop: { select: { name: true, phone: true, city: true, address: true } },
    },
  })

  if (!shareLink || !shareLink.isActive || (shareLink.expiresAt && shareLink.expiresAt < new Date())) {
    notFound()
  }

  const { intakeForm, workshop } = shareLink
  const safeIntakeForm = {
    status: intakeForm.status,
    mileageAtIntake: intakeForm.mileageAtIntake,
    customerComplaint: intakeForm.customerComplaint,
    approvedAt: intakeForm.approvedAt,
    createdAt: intakeForm.createdAt,
    vehicle: {
      plate: intakeForm.vehicle.plate,
      brand: intakeForm.vehicle.brand,
      model: intakeForm.vehicle.model,
      modelYear: intakeForm.vehicle.modelYear,
      mileage: intakeForm.vehicle.mileage,
      vin: intakeForm.vehicle.vin,
    },
    customer: {
      firstName: intakeForm.customer.firstName,
      lastName: intakeForm.customer.lastName,
      fullName: intakeForm.customer.fullName,
      companyName: intakeForm.customer.companyName,
      contactName: intakeForm.customer.contactName,
      type: intakeForm.customer.type,
      phone: intakeForm.customer.phone,
    },
    photos: intakeForm.photos,
    damageMarks: intakeForm.damageMarks,
    approvals: intakeForm.approvals,
    order: intakeForm.order,
  }

  const html = await generatePdfHtml({
    workshop,
    intakeForm: safeIntakeForm,
    createdAt: shareLink.createdAt,
  })

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  })
}