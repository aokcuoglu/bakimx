"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { exportOrdersToCSV, downloadCSV } from "./order-export"

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

interface OrderExportButtonProps {
  orders: Order[]
}

export function OrderExportButton({ orders }: OrderExportButtonProps) {
  const handleExport = () => {
    const csv = exportOrdersToCSV(orders)
    const filename = `siparisler-${new Date().toISOString().split("T")[0]}.csv`
    downloadCSV(csv, filename)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      CSV İndir
    </Button>
  )
}
