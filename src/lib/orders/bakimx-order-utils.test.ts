import { describe, it, expect } from "bun:test"
import {
  getOrderStatusLabel,
  getPaymentStatusLabel,
  canUpdateOrderStatus,
  isOrderEditable,
  isOrderCancellable,
  calculateOrderTotalWithTax
} from "./bakimx-order-utils"

describe("BakIMX Order Utils", () => {
  describe("getOrderStatusLabel", () => {
    it("should return Turkish label for valid status", () => {
      const label = getOrderStatusLabel("pending")
      expect(label.label).toBe("Beklemede")
      expect(label.variant).toBe("outline")
    })

    it("should return status as label for unknown status", () => {
      const label = getOrderStatusLabel("unknown_status")
      expect(label.label).toBe("unknown_status")
    })
  })

  describe("getPaymentStatusLabel", () => {
    it("should return Turkish payment status labels", () => {
      expect(getPaymentStatusLabel("unpaid")).toBe("Ödenmemiş")
      expect(getPaymentStatusLabel("partial")).toBe("Kısmi Ödeme")
      expect(getPaymentStatusLabel("paid")).toBe("Ödendi")
    })
  })

  describe("canUpdateOrderStatus", () => {
    it("should allow valid transitions", () => {
      expect(canUpdateOrderStatus("pending", "confirmed")).toBe(true)
      expect(canUpdateOrderStatus("confirmed", "payment_requested")).toBe(true)
      expect(canUpdateOrderStatus("shipped", "delivered")).toBe(true)
    })

    it("should reject invalid transitions", () => {
      expect(canUpdateOrderStatus("pending", "delivered")).toBe(false)
      expect(canUpdateOrderStatus("delivered", "pending")).toBe(false)
      expect(canUpdateOrderStatus("return_accepted", "shipped")).toBe(false)
    })
  })

  describe("isOrderEditable", () => {
    it("should return true for pending and confirmed orders", () => {
      expect(isOrderEditable("pending")).toBe(true)
      expect(isOrderEditable("confirmed")).toBe(true)
    })

    it("should return false for other statuses", () => {
      expect(isOrderEditable("shipped")).toBe(false)
      expect(isOrderEditable("delivered")).toBe(false)
      expect(isOrderEditable("cancelled")).toBe(false)
    })
  })

  describe("isOrderCancellable", () => {
    it("should return true for cancellable statuses", () => {
      expect(isOrderCancellable("pending")).toBe(true)
      expect(isOrderCancellable("confirmed")).toBe(true)
      expect(isOrderCancellable("shipped")).toBe(true)
    })

    it("should return false for non-cancellable statuses", () => {
      expect(isOrderCancellable("delivered")).toBe(false)
      expect(isOrderCancellable("return_accepted")).toBe(false)
    })
  })

  describe("calculateOrderTotalWithTax", () => {
    it("should calculate total with default 20% VAT", () => {
      const result = calculateOrderTotalWithTax(100000)
      expect(result.subtotal).toBe(100000)
      expect(result.tax).toBe(20000)
      expect(result.total).toBe(120000)
    })

    it("should calculate total with custom tax rate", () => {
      const result = calculateOrderTotalWithTax(100000, 1000) // 10% VAT
      expect(result.tax).toBe(10000)
      expect(result.total).toBe(110000)
    })
  })
})
