"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { updateOrderStatus, updatePaymentStatus } from "../actions"
import { BakimxOrderStatus, BakimxPaymentStatus } from "@/lib/validations/bakimx-order"
import { getOrderStatusLabel, getPaymentStatusLabel } from "@/lib/orders/bakimx-order-utils"

interface OrderStatusActionsProps {
  orderId: string
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

export default function OrderStatusActions({ orderId }: OrderStatusActionsProps) {
  const { toast } = useToast()
  const [orderStatus, setOrderStatus] = useState("")
  const [paymentStatus, setPaymentStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleOrderStatusChange = async (newStatus: string | null) => {
    if (!newStatus) return

    setIsLoading(true)
    try {
      const result = await updateOrderStatus(orderId, newStatus)
      if (result.success) {
        setOrderStatus(newStatus)
        toast({
          title: "Başarılı",
          description: "Sipariş durumu güncellendi"
        })
      } else {
        throw new Error(result.error || "Failed to update status")
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Durum güncellenemedi",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaymentStatusChange = async (newStatus: string | null) => {
    if (!newStatus) return

    setIsLoading(true)
    try {
      const result = await updatePaymentStatus(orderId, newStatus)
      if (result.success) {
        setPaymentStatus(newStatus)
        toast({
          title: "Başarılı",
          description: "Ödeme durumu güncellendi"
        })
      } else {
        throw new Error(result.error || "Failed to update payment status")
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Ödeme durumu güncellenemedi",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <label className="text-sm font-medium">Sipariş Durumu</label>
        <Select value={orderStatus} onValueChange={handleOrderStatusChange} disabled={isLoading}>
          <SelectTrigger>
            <SelectValue placeholder="Durum seçin" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((status) => {
              const { label } = getOrderStatusLabel(status)
              return (
                <SelectItem key={status} value={status}>
                  {label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Ödeme Durumu</label>
        <Select value={paymentStatus} onValueChange={handlePaymentStatusChange} disabled={isLoading}>
          <SelectTrigger>
            <SelectValue placeholder="Durum seçin" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {getPaymentStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
