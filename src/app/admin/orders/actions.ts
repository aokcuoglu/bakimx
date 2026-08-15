"use server"

import { prisma } from "@/lib/db"
import { createBakimxOrderSchema, updateBakimxOrderSchema } from "@/lib/validations/bakimx-order"
import { z } from "zod"

export async function updateOrderStatus(orderId: string, status: string) {
  try {
    const order = await prisma.bakimxOrder.update({
      where: { id: orderId },
      data: { status }
    })
    return { success: true, order }
  } catch (error) {
    return { success: false, error: "Failed to update order status" }
  }
}

export async function updatePaymentStatus(orderId: string, paymentStatus: string) {
  try {
    const order = await prisma.bakimxOrder.update({
      where: { id: orderId },
      data: { paymentStatus }
    })
    return { success: true, order }
  } catch (error) {
    return { success: false, error: "Failed to update payment status" }
  }
}

export async function addOrderNote(orderId: string, content: string) {
  try {
    if (!content.trim()) {
      throw new Error("Note cannot be empty")
    }

    // For now, we'll update the order's notes field if it exists
    // In a full implementation, this would be a separate BakimxOrderNote table
    const order = await prisma.bakimxOrder.findUnique({
      where: { id: orderId },
      select: { notes: true }
    })

    if (!order) {
      throw new Error("Order not found")
    }

    const notes = (order.notes || "") + (order.notes ? "\n---\n" : "") + content

    const updated = await prisma.bakimxOrder.update({
      where: { id: orderId },
      data: { notes }
    })

    return { success: true, note: content, order: updated }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add note" }
  }
}

export async function createBakimxOrder(data: any) {
  try {
    const validated = createBakimxOrderSchema.parse(data)

    // Calculate total price
    let totalPriceKurus = 0
    const items = []

    for (const item of validated.items) {
      let unitPrice = item.unit_price_kurus || 0

      // If price not provided, fetch from product
      if (!unitPrice) {
        const product = await prisma.bakimxProduct.findUnique({
          where: { id: item.productId },
          select: { workshopPriceKurus: true }
        })
        unitPrice = product?.workshopPriceKurus || 0
      }

      const itemTotal = unitPrice * item.quantity
      totalPriceKurus += itemTotal

      items.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceKurus: unitPrice,
        totalPriceKurus: itemTotal
      })
    }

    const order = await prisma.bakimxOrder.create({
      data: {
        workshopId: validated.workshopId,
        status: "pending",
        paymentStatus: "unpaid",
        totalPriceKurus,
        notes: validated.notes || null,
        items: {
          createMany: {
            data: items
          }
        }
      },
      include: {
        workshop: true,
        items: {
          include: { product: true }
        }
      }
    })

    return { success: true, order }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: error instanceof Error ? error.message : "Failed to create order" }
  }
}

export async function updateBakimxOrder(orderId: string, data: any) {
  try {
    const validated = updateBakimxOrderSchema.parse(data)

    const order = await prisma.bakimxOrder.update({
      where: { id: orderId },
      data: validated,
      include: {
        workshop: true,
        items: {
          include: { product: true }
        }
      }
    })

    return { success: true, order }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message }
    }
    return { success: false, error: error instanceof Error ? error.message : "Failed to update order" }
  }
}

export async function recordStockMovement(
  orderId: string,
  productId: string,
  quantity: number,
  type: string,
  reason: string
) {
  try {
    const movement = await prisma.bakimxStockMovement.create({
      data: {
        orderId,
        productId,
        quantity,
        type,
        reason,
        getirbakimSyncedAt: null
      },
      include: {
        product: true
      }
    })

    return { success: true, movement }
  } catch (error) {
    return { success: false, error: "Failed to record stock movement" }
  }
}
