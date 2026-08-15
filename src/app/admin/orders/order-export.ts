import { formatKurus } from "@/lib/currency"
import { getOrderStatusLabel, getPaymentStatusLabel } from "@/lib/orders/bakimx-order-utils"

interface Order {
  id: string
  workshopId: string
  workshop?: { name: string }
  status: string
  paymentStatus: string
  totalPriceKurus: number
  notes?: string
  createdAt: Date
  items: Array<{
    id: string
    productId: string
    product?: { name: string; sku: string }
    quantity: number
    unitPriceKurus: number
    totalPriceKurus: number
  }>
}

export function exportOrdersToCSV(orders: Order[]): string {
  const headers = [
    "Sipariş ID",
    "Atölye",
    "Durum",
    "Ödeme Durumu",
    "Toplam",
    "Ürün Sayısı",
    "Oluşturma Tarihi"
  ]

  const rows = orders.map((order) => [
    `BX-${order.id.slice(0, 8).toUpperCase()}`,
    order.workshop?.name || "—",
    getOrderStatusLabel(order.status).label,
    getPaymentStatusLabel(order.paymentStatus),
    formatKurus(order.totalPriceKurus).replace("₺", "").trim(),
    order.items.length,
    new Date(order.createdAt).toLocaleDateString("tr-TR")
  ])

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

  return csv
}

export function exportOrderDetailsToCSV(order: Order): string {
  const headers = [
    "Sipariş Bilgisi",
    "Değer"
  ]

  const details = [
    ["Sipariş ID", `BX-${order.id.slice(0, 8).toUpperCase()}`],
    ["Atölye", order.workshop?.name || "—"],
    ["Durumu", getOrderStatusLabel(order.status).label],
    ["Ödeme Durumu", getPaymentStatusLabel(order.paymentStatus)],
    ["Toplam Tutar", formatKurus(order.totalPriceKurus)],
    ["Notlar", order.notes || "—"],
    ["Oluşturma Tarihi", new Date(order.createdAt).toLocaleDateString("tr-TR")],
    ["", ""],
    ["Ürünler", ""],
    ["Ürün Adı", "SKU", "Miktar", "Birim Fiyat", "Toplam Fiyat"]
  ]

  const itemHeaders = ["Ürün Adı", "SKU", "Miktar", "Birim Fiyat", "Toplam Fiyat"]
  const itemRows = order.items.map((item) => [
    item.product?.name || "Bilinmeyen Ürün",
    item.product?.sku || "—",
    item.quantity.toString(),
    formatKurus(item.unitPriceKurus).replace("₺", "").trim(),
    formatKurus(item.totalPriceKurus).replace("₺", "").trim()
  ])

  const allRows = [...details.filter((d) => d.length === 2), ...itemRows]

  const csv = [headers, ...allRows].map((row) => {
    if (row.length === 1) return row[0]
    return row.map((cell) => `"${cell}"`).join(",")
  }).join("\n")

  return csv
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
