import { z } from "zod"

export const BakimxOrderStatus = z.enum([
  "pending",
  "confirmed",
  "payment_requested",
  "failed_to_sync",
  "shipped",
  "delivered",
  "return_requested",
  "return_accepted",
  "cancelled"
])

export const BakimxPaymentStatus = z.enum(["unpaid", "partial", "paid"])

export const BakimxOrderItemStatus = z.enum([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled"
])

export const createBakimxOrderSchema = z.object({
  workshopId: z.string().min(1, "Workshop is required"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product is required"),
        quantity: z.number().min(1, "Quantity must be at least 1"),
        unit_price_kurus: z.number().nonnegative().optional()
      })
    )
    .min(1, "At least one item is required"),
  notes: z.string().optional()
})

export const updateBakimxOrderSchema = z.object({
  status: BakimxOrderStatus.optional(),
  paymentStatus: BakimxPaymentStatus.optional(),
  notes: z.string().optional()
})

export const recordStockMovementSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  quantity: z.number().positive(),
  type: z.enum(["deduction", "return", "adjustment", "initial"]),
  reason: z.string().optional()
})

export type CreateBakimxOrderInput = z.infer<typeof createBakimxOrderSchema>
export type UpdateBakimxOrderInput = z.infer<typeof updateBakimxOrderSchema>
export type RecordStockMovementInput = z.infer<typeof recordStockMovementSchema>
