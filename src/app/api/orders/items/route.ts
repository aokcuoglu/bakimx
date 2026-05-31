import { addOrderItemAction, removeOrderItemAction } from "@/app/app/orders/actions"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await addOrderItemAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    const orderId = url.searchParams.get("orderId")
    if (!id || !orderId) {
      return NextResponse.json({ error: "Parametreler eksik" }, { status: 400 })
    }
    const result = await removeOrderItemAction(id, orderId)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}