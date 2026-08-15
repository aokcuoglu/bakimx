import { useState, useCallback } from "react"

interface OrderState {
  id: string
  status: string
  paymentStatus: string
  isLoading: boolean
}

export function useOrder(initialOrder: any) {
  const [order, setOrder] = useState<OrderState>({
    id: initialOrder.id,
    status: initialOrder.status,
    paymentStatus: initialOrder.paymentStatus,
    isLoading: false
  })

  const updateOrderStatus = useCallback((newStatus: string) => {
    setOrder((prev) => ({
      ...prev,
      status: newStatus
    }))
  }, [])

  const updatePaymentStatus = useCallback((newStatus: string) => {
    setOrder((prev) => ({
      ...prev,
      paymentStatus: newStatus
    }))
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setOrder((prev) => ({
      ...prev,
      isLoading: loading
    }))
  }, [])

  return {
    order,
    updateOrderStatus,
    updatePaymentStatus,
    setLoading
  }
}
