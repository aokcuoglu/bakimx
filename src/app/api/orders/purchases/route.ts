import { addPurchaseItemAction, updatePurchaseItemAction } from "@/app/(app)/orders/actions"
import { NextResponse } from "next/server"

// Dış alım (source=purchase) kalemleri. Fotoğraf 8MB'a kadar olabildiğinden
// server-action body limitine takılmamak için API route üzerinden çağrılır.

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await addPurchaseItemAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: result.id })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    const orderId = url.searchParams.get("orderId")
    if (!id || !orderId) {
      return NextResponse.json({ error: "Parametreler eksik" }, { status: 400 })
    }
    const formData = await request.formData()
    const result = await updatePurchaseItemAction(id, orderId, formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
