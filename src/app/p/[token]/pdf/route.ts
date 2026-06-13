import { prisma } from "@/lib/db"
import { sanitizePassportForPublic } from "@/lib/passport/data-safety"
import { formatTRY, formatMileage } from "@/lib/format"
import { VEHICLE_ZONES } from "@/lib/constants"

export const dynamic = "force-dynamic"

async function generatePassportPdfHtml(data: {
  workshop: { name: string; phone: string; city: string; address: string }
  passportData: ReturnType<typeof sanitizePassportForPublic>
  vehicle: { plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null; vehicleType: string | null; color: string | null; fuelType: string | null; transmission: string | null }
  customer: { firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; contactName: string | null; type: string; phone: string }
  visibility: { showServiceHistory: boolean; showWorkOrders: boolean; showDamages: boolean; showPhotos: boolean; showReminders: boolean; showPaymentStatus: boolean }
  createdAt: string
}): Promise<string> {
  const { workshop, passportData, vehicle, customer, visibility, createdAt } = data
  const customerName = customer.type === "corporate"
    ? customer.companyName || customer.contactName || "Kurumsal Müşteri"
    : customer.fullName || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Müşteri"
  const vehicleLabel = `${vehicle.brand} ${vehicle.model}${vehicle.modelYear ? ` ${vehicle.modelYear}` : ""}`

  const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("tr-TR")

  let workOrdersHtml = ""
  if (visibility.showWorkOrders && passportData.workOrders.length > 0) {
    workOrdersHtml = `<div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">İş Emirleri (${passportData.workOrders.length})</h3>`
    for (const wo of passportData.workOrders) {
      const itemsHtml = wo.items.map((item) => {
        const total = item.totalPrice ?? (item.unitPrice ? item.unitPrice * item.quantity : null)
        return `<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;">
          <span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${item.type === "part" ? "#2563EB" : "#7C3AED"};margin-right:4px;vertical-align:middle;"></span>${item.name} ×${item.quantity}</span>
          <span>${total ? formatTRY(total) : "—"}</span>
        </div>`
      }).join("")

      workOrdersHtml += `<div style="border:1px solid #E5E7EB;border-radius:6px;padding:8px;margin-bottom:6px;background:#fff;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <div><span style="font-family:monospace;font-size:9px;font-weight:600;color:#666;">${wo.workOrderNo || "—"}</span> <span style="font-size:9px;padding:1px 6px;border-radius:10px;border:1px solid #0B1F3A;color:#0B1F3A;">${wo.statusLabel}</span>${wo.paymentStatusLabel && visibility.showPaymentStatus ? ` <span style="font-size:9px;padding:1px 6px;border-radius:10px;border:1px solid #999;color:#666;">${wo.paymentStatusLabel}</span>` : ""}</div>
          <span style="font-size:9px;color:#999;">${fmtDate(wo.createdAt)}</span>
        </div>
        <div style="font-size:10px;color:#333;margin-bottom:4px;">${wo.customerComplaint}</div>
        ${wo.items.length > 0 ? `<div style="border-top:1px solid #f1f5f9;padding-top:4px;margin-top:4px;">${itemsHtml}</div>` : ""}
        ${wo.grandTotal && wo.grandTotal > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;border-top:2px solid #0B1F3A;padding-top:4px;margin-top:4px;"><span>Toplam</span><span>${formatTRY(wo.grandTotal)}</span></div>` : ""}
      </div>`
    }
    workOrdersHtml += `</div>`
  }

  let damagesHtml = ""
  if (visibility.showDamages && passportData.damageHistory.length > 0) {
    const damageRows = passportData.damageHistory.map((dm) =>
      `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;">${dm.zoneLabel || VEHICLE_ZONES[dm.zone as keyof typeof VEHICLE_ZONES] || dm.zone}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;">${dm.damageTypeLabel || dm.damageType}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;">${dm.severityLabel || dm.severity}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;color:#999;">${dm.note || "—"}</td>
      </tr>`
    ).join("")

    damagesHtml = `<div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Hasar Kayıtları (${passportData.damageHistory.length})</h3>
      <div style="border:1px solid #E5E7EB;border-radius:6px;padding:0;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:9px;">
          <thead><tr style="background:#f8fafc;"><th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Bölge</th><th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Tip</th><th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Şiddet</th><th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e2e8f0;">Not</th></tr></thead>
          <tbody>${damageRows}</tbody>
        </table>
      </div>
    </div>`
  }

  let remindersHtml = ""
  if (visibility.showReminders && passportData.reminders.length > 0) {
    const reminderRows = passportData.reminders.map((r) =>
      `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;">
        <div><span style="font-weight:600;font-size:9px;">${r.title}</span> <span style="font-size:8px;padding:1px 4px;border-radius:8px;border:1px solid #2563EB;color:#2563EB;">${r.typeLabel}</span> <span style="font-size:8px;padding:1px 4px;border-radius:8px;border:1px solid #999;color:#666;">${r.statusLabel}</span></div>
        <div style="font-size:8px;color:#999;">${r.dueDate ? fmtDate(r.dueDate) : ""}${r.dueMileage ? ` ${r.dueMileage.toLocaleString("tr-TR")} km` : ""}</div>
      </div>`
    ).join("")

    remindersHtml = `<div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Bakım Hatırlatmaları (${passportData.reminders.length})</h3>
      <div style="border:1px solid #E5E7EB;border-radius:6px;padding:8px;background:#fff;">
        ${reminderRows}
      </div>
    </div>`
  }

  let timelineHtml = ""
  if (visibility.showServiceHistory && passportData.serviceHistory.length > 0) {
    const timelineRows = passportData.serviceHistory.slice(0, 20).map((e) =>
      `<div style="padding:4px 0;border-left:2px solid #e2e8f0;margin-left:8px;padding-left:12px;">
        <div style="font-weight:600;font-size:9px;">${e.description}</div>
        <div style="font-size:8px;color:#999;">${new Date(e.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
      </div>`
    ).join("")

    timelineHtml = `<div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Servis Zaman Çizelgesi</h3>
      <div style="border:1px solid #E5E7EB;border-radius:6px;padding:8px;background:#fff;">
        ${timelineRows}
      </div>
    </div>`
  }

  let photosHtml = ""
  if (visibility.showPhotos && passportData.photoHistory.length > 0) {
    const photoRows = passportData.photoHistory.map((p) =>
      `<div style="padding:3px 0;color:#333;font-size:9px;">✓ ${p.label} <span style="font-size:8px;color:#999;">(${fmtDate(p.createdAt)})</span></div>`
    ).join("")

    photosHtml = `<div style="margin-bottom:12px;">
      <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Fotoğraflar (${passportData.photoHistory.length})</h3>
      <div style="border:1px solid #E5E7EB;border-radius:6px;padding:8px;background:#fff;">
        ${photoRows}
      </div>
    </div>`
  }

  const statsHtml = `<div style="margin-bottom:12px;">
    <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Servis Özeti</h3>
    <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;display:flex;gap:16px;">
      <div style="text-align:center;flex:1;">
        <div style="font-size:16px;font-weight:700;color:#2563EB;">${passportData.workOrders.length}</div>
        <div style="font-size:8px;color:#666;">İş Emri</div>
      </div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:16px;font-weight:700;color:#059669;">${passportData.workOrders.filter((wo) => wo.status === "delivered").length}</div>
        <div style="font-size:8px;color:#666;">Tamamlanan</div>
      </div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:16px;font-weight:700;color:#D97706;">${passportData.damageHistory.length}</div>
        <div style="font-size:8px;color:#666;">Hasar</div>
      </div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:16px;font-weight:700;color:#7C3AED;">${passportData.photoHistory.length}</div>
        <div style="font-size:8px;color:#666;">Fotoğraf</div>
      </div>
    </div>
    ${visibility.showPaymentStatus && passportData.workOrders.reduce((sum, wo) => sum + (wo.grandTotal ?? 0), 0) > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;"><span>Toplam Harcama</span><span>${formatTRY(passportData.workOrders.reduce((sum, wo) => sum + (wo.grandTotal ?? 0), 0))}</span></div>` : ""}
  </div>`

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
      <p style="font-size:10px;color:#666;margin:2px 0 0;">Dijital Servis Pasaportu</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#333;">${fmtDate(createdAt)}</div>
      <div style="font-size:8px;color:#999;">BakimX ile oluşturuldu</div>
    </div>
  </div>

  <div style="margin-bottom:12px;">
    <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Araç & Müşteri</h3>
    <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;display:flex;gap:24px;">
      <div style="flex:1;">
        <div style="font-size:10px;color:#666;">Araç</div>
        <div style="font-weight:700;">${vehicle.plate}</div>
        <div style="font-size:9px;color:#666;">${vehicleLabel}${vehicle.color ? ` • ${vehicle.color}` : ""}${vehicle.fuelType ? ` • ${vehicle.fuelType}` : ""}</div>
        ${vehicle.mileage ? `<div style="font-size:9px;color:#666;">Kilometre: ${formatMileage(vehicle.mileage)}</div>` : ""}
        ${vehicle.vin ? `<div style="font-size:8px;color:#999;font-family:monospace;">VIN: ${vehicle.vin}</div>` : ""}
      </div>
      <div style="flex:1;">
        <div style="font-size:10px;color:#666;">Müşteri</div>
        <div style="font-weight:700;">${customerName}</div>
        <div style="font-size:9px;color:#666;">Tel: ${customer.phone}</div>
      </div>
    </div>
  </div>

  ${statsHtml}
  ${workOrdersHtml}
  ${damagesHtml}
  ${photosHtml}
  ${remindersHtml}
  ${timelineHtml}

  <div style="margin-bottom:12px;">
    <h3 style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">İş Yeri Bilgileri</h3>
    <div style="border:1px solid #E5E7EB;border-radius:6px;padding:10px;background:#fff;">
      <div style="font-weight:700;">★ ${workshop.name}</div>
      <div style="font-size:9px;color:#666;">${workshop.city}, ${workshop.address}</div>
      <div style="font-size:9px;color:#666;">Tel: ${workshop.phone}</div>
    </div>
  </div>

  <div style="text-align:center;margin-top:10px;padding:8px;border:1px solid #DBEAFE;border-radius:6px;background:#EFF6FF;color:#1E40AF;font-size:8px;">
    Bu sayfa yalnızca yetkili kişilerle paylaşım içindir. İç notlar, OCR verileri ve iş yeri iç kimlik bilgileri bu sayfada gösterilmez.
  </div>

  <div style="text-align:center;margin-top:12px;padding-top:10px;border-top:1px solid #E5E7EB;color:#999;font-size:8px;">
    <div>Bu çıktı, araç dijital servis pasaportu amacıyla oluşturulmuştur.</div>
    <div style="margin-top:4px;">BakimX ile oluşturuldu • ${fmtDate(createdAt)}</div>
  </div>
</body>
</html>`
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const passportToken = await prisma.vehiclePassportToken.findUnique({
    where: { token },
    include: {
      vehicle: {
        include: {
          customer: true,
          intakes: {
            include: {
              order: { include: { items: true } },
              damageMarks: true,
              photos: {
                select: { id: true, type: true, label: true, fileUrl: true, phase: true, createdAt: true },
              },
              timelineEvents: {
                select: { eventType: true, description: true, createdAt: true },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      workshop: { select: { name: true, phone: true, city: true, address: true, logoUrl: true } },
    },
  })

  if (!passportToken || !passportToken.isActive || (passportToken.expiresAt && passportToken.expiresAt < new Date())) {
    return new Response(null, { status: 404 })
  }

  const { vehicle, workshop } = passportToken

  const reminders = await prisma.maintenanceReminder.findMany({
    where: { vehicleId: vehicle.id, status: { notIn: ["cancelled"] } },
    orderBy: { dueDate: "asc" },
  })

  const visibility = {
    showServiceHistory: passportToken.showServiceHistory,
    showWorkOrders: passportToken.showWorkOrders,
    showDamages: passportToken.showDamages,
    showPhotos: passportToken.showPhotos,
    showReminders: passportToken.showReminders,
    showPaymentStatus: passportToken.showPaymentStatus,
  }

  const passportData = sanitizePassportForPublic(
    {
      vehicle: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        modelYear: vehicle.modelYear,
        mileage: vehicle.mileage,
        vin: vehicle.vin,
        vehicleType: vehicle.vehicleType,
        color: vehicle.color,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
      },
      customer: {
        firstName: vehicle.customer.firstName,
        lastName: vehicle.customer.lastName,
        fullName: vehicle.customer.fullName,
        companyName: vehicle.customer.companyName,
        contactName: vehicle.customer.contactName,
        type: vehicle.customer.type,
        phone: vehicle.customer.phone,
      },
      intakes: vehicle.intakes.map((i) => ({
        status: i.status,
        mileageAtIntake: i.mileageAtIntake,
        customerComplaint: i.customerComplaint,
        createdAt: i.createdAt,
        timelineEvents: i.timelineEvents.map((e) => ({
          eventType: e.eventType,
          description: e.description,
          createdAt: e.createdAt,
        })),
        order: i.order
          ? {
              workOrderNo: i.order.workOrderNo,
              status: i.order.status,
              paymentStatus: i.order.paymentStatus,
              items: i.order.items.map((item) => ({
                type: item.type,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              })),
              discountAmount: i.order.discountAmount,
              taxRate: i.order.taxRate,
            }
          : null,
      })),
      damageMarks: vehicle.intakes.flatMap((i) =>
        i.damageMarks.map((dm) => ({
          zone: dm.zone,
          damageType: dm.damageType,
          severity: dm.severity,
          note: dm.note,
          createdAt: dm.createdAt,
        }))
      ),
      photos: vehicle.intakes.flatMap((i) =>
        i.photos.map((p) => ({
          id: p.id,
          type: p.type,
          label: p.label,
          fileUrl: p.fileUrl,
          phase: p.phase,
          createdAt: p.createdAt,
        }))
      ),
        reminders: reminders.map((r) => ({
          title: r.title,
          type: r.type,
          status: r.status,
          dueDate: r.dueDate,
          dueMileage: r.dueMileage,
          lastServiceDate: r.lastServiceDate,
          lastServiceMileage: r.lastServiceMileage,
          customerNote: r.customerNote,
          completedAt: r.completedAt,
        })),
    },
    visibility
  )

  const html = await generatePassportPdfHtml({
    workshop,
    passportData,
    vehicle: {
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      modelYear: vehicle.modelYear,
      mileage: vehicle.mileage,
      vin: vehicle.vin,
      vehicleType: vehicle.vehicleType,
      color: vehicle.color,
      fuelType: vehicle.fuelType,
      transmission: vehicle.transmission,
    },
    customer: {
      firstName: vehicle.customer.firstName,
      lastName: vehicle.customer.lastName,
      fullName: vehicle.customer.fullName,
      companyName: vehicle.customer.companyName,
      contactName: vehicle.customer.contactName,
      type: vehicle.customer.type,
      phone: vehicle.customer.phone,
    },
    visibility,
    createdAt: passportToken.createdAt.toISOString(),
  })

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  })
}