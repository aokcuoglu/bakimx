"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import { BakimxOrderStatus, BakimxPaymentStatus } from "@/lib/validations/bakimx-order"
import { getOrderStatusLabel, getPaymentStatusLabel } from "@/lib/orders/bakimx-order-utils"

interface OrderFiltersProps {
  onFilterChange?: (filters: {
    status?: string
    paymentStatus?: string
    workshopId?: string
    search?: string
  }) => void
}

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "payment_requested",
  "failed_to_sync",
  "shipped",
  "delivered",
  "return_requested",
  "return_accepted",
  "cancelled"
]

const PAYMENT_STATUSES = ["unpaid", "partial", "paid"]

export function OrderFilters({ onFilterChange }: OrderFiltersProps) {
  const [status, setStatus] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const handleStatusChange = (newStatus: string | null) => {
    setStatus(newStatus)
    onFilterChange?.({ status: newStatus || undefined, paymentStatus: paymentStatus || undefined, search })
  }

  const handlePaymentChange = (newStatus: string | null) => {
    setPaymentStatus(newStatus)
    onFilterChange?.({ status: status || undefined, paymentStatus: newStatus || undefined, search })
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFilterChange?.({ status: status || undefined, paymentStatus: paymentStatus || undefined, search: value })
  }

  const hasFilters = status || paymentStatus || search

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Sipariş numarası, atölye adı..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus(null)
              setPaymentStatus(null)
              setSearch("")
              onFilterChange?.({})
            }}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Temizle
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Select value={status || ""} onValueChange={handleStatusChange}>
          <SelectTrigger>
            <SelectValue placeholder="Sipariş Durumu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tümü</SelectItem>
            {ORDER_STATUSES.map((s) => {
              const { label } = getOrderStatusLabel(s)
              return (
                <SelectItem key={s} value={s}>
                  {label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Select value={paymentStatus || ""} onValueChange={handlePaymentChange}>
          <SelectTrigger>
            <SelectValue placeholder="Ödeme Durumu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tümü</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {getPaymentStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
