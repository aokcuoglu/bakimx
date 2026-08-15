import { describe, it, expect } from "bun:test"
import { createBakimxOrderSchema, updateBakimxOrderSchema } from "./bakimx-order"

describe("BakIMX Order Validations", () => {
  describe("createBakimxOrderSchema", () => {
    it("should validate correct order data", () => {
      const validData = {
        workshopId: "workshop-1",
        items: [
          {
            productId: "product-1",
            quantity: 2,
            unit_price_kurus: 50000
          }
        ]
      }

      const result = createBakimxOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should reject order without workshopId", () => {
      const invalidData = {
        items: [
          {
            productId: "product-1",
            quantity: 2
          }
        ]
      }

      const result = createBakimxOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should reject order without items", () => {
      const invalidData = {
        workshopId: "workshop-1",
        items: []
      }

      const result = createBakimxOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should reject order with invalid quantity", () => {
      const invalidData = {
        workshopId: "workshop-1",
        items: [
          {
            productId: "product-1",
            quantity: 0
          }
        ]
      }

      const result = createBakimxOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should accept order without explicit price", () => {
      const validData = {
        workshopId: "workshop-1",
        items: [
          {
            productId: "product-1",
            quantity: 1
          }
        ]
      }

      const result = createBakimxOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should accept order with notes", () => {
      const validData = {
        workshopId: "workshop-1",
        items: [
          {
            productId: "product-1",
            quantity: 1
          }
        ],
        notes: "Special request"
      }

      const result = createBakimxOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe("updateBakimxOrderSchema", () => {
    it("should validate partial updates", () => {
      const validData = {
        status: "confirmed"
      }

      const result = updateBakimxOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should accept empty update", () => {
      const validData = {}

      const result = updateBakimxOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should validate status change", () => {
      const validData = {
        status: "shipped",
        paymentStatus: "paid"
      }

      const result = updateBakimxOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should reject invalid status", () => {
      const invalidData = {
        status: "invalid_status"
      }

      const result = updateBakimxOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should reject invalid payment status", () => {
      const invalidData = {
        paymentStatus: "invalid_payment_status"
      }

      const result = updateBakimxOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should allow updating only notes", () => {
      const validData = {
        notes: "Updated notes"
      }

      const result = updateBakimxOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })
})
