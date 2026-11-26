import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/cashbox/feature-auth"
import { getCollections, getOpenReceivables, getReceivableAging } from "@/lib/cashbox/queries"
import { collectionPeriodFromSearchParams, resolveCollectionRange } from "@/lib/cashbox/period"
import { istanbulDayKey } from "@/lib/istanbul-time"

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "collections"

    const BOM = "\uFEFF"
    let csv = ""

    if (type === "collections") {
      const q = searchParams.get("q") || undefined
      const method = searchParams.get("method") || undefined
      const status = searchParams.get("status") || undefined
      // Ekranla aynı çözümleyici — CSV listedeki kayıtların aynısını verir (#906).
      const range = resolveCollectionRange(collectionPeriodFromSearchParams(searchParams))

      const { rows } = await getCollections(user.workshopId, {
        q,
        method,
        status,
        rangeStart: range.start,
        rangeEnd: range.end,
        limit: 5000,
      })

      const nameFor = (c: typeof rows[number]["customer"]) =>
        c.type === "corporate" ? c.companyName || "—" : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"

      const methodLabels: Record<string, string> = { cash: "Nakit", credit_card: "Kredi Kartı", bank_transfer: "Havale/EFT", other: "Diğer" }
      const statusLabels: Record<string, string> = { completed: "Tamamlandı", cancelled: "İptal", refunded: "İade" }

      const headers = ["Tarih", "Müşteri", "Telefon", "Araç Kabul", "Tutar", "Yöntem", "Durum", "Referans No", "Not"]
      const csvRows = rows.map((r) => [
        istanbulDayKey(new Date(r.paymentDate)),
        nameFor(r.customer),
        r.customer.phone,
        r.serviceOrder?.workOrderNo || "",
        r.amount,
        methodLabels[r.method] || r.method,
        statusLabels[r.status] || r.status,
        r.referenceNo || "",
        r.note || "",
      ])
      csv = BOM + [headers.join(","), ...csvRows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n")
    } else if (type === "receivables") {
      const receivables = await getOpenReceivables(user.workshopId, 5000)
      const nameFor = (c: typeof receivables[number]["customer"]) =>
        c.type === "corporate" ? c.companyName || "—" : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"

      const statusLabels: Record<string, string> = { unpaid: "Ödenmedi", partial: "Kısmi ödeme", paid: "Ödendi", overpaid: "Fazla Ödeme", cancelled: "İptal" }

      const headers = ["Araç Kabul No", "Müşteri", "Telefon", "Araç", "Toplam", "Ödenen", "Kalan", "Ödeme Durumu", "Oluşturma Tarihi"]
      const csvRows = receivables.map((r) => [
        r.workOrderNo || "",
        nameFor(r.customer),
        r.customer.phone,
        `${r.vehicle.plate} ${r.vehicle.brand} ${r.vehicle.model}`,
        r.grandTotal,
        r.paidAmount,
        r.remainingAmount,
        statusLabels[r.paymentStatus] || r.paymentStatus,
        istanbulDayKey(new Date(r.createdAt)),
      ])
      csv = BOM + [headers.join(","), ...csvRows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n")
    } else if (type === "aging") {
      const aging = await getReceivableAging(user.workshopId)
      const headers = ["Vade Grubu", "Toplam Tutar", "Müşteri Sayısı", "Müşteri", "Tutar"]
      const csvRows: string[][] = []
      for (const bucket of aging) {
        for (let i = 0; i < bucket.customers.length; i++) {
          csvRows.push([
            bucket.label,
            i === 0 ? String(bucket.totalAmount) : "",
            i === 0 ? String(bucket.count) : "",
            bucket.customers[i].customerName,
            String(bucket.customers[i].amount),
          ])
        }
        if (bucket.customers.length === 0) {
          csvRows.push([bucket.label, String(bucket.totalAmount), String(bucket.count), "", ""])
        }
      }
      csv = BOM + [headers.join(","), ...csvRows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n")
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="bakimx-${type}-${istanbulDayKey(new Date())}.csv"`,
      },
    })
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json({ error: "Dışa aktarma hatası" }, { status: 500 })
  }
}
