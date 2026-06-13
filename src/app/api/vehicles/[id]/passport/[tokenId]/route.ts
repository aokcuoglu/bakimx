import { updatePassportTokenAction, deletePassportTokenAction } from "@/app/app/vehicles/[id]/passport/actions"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; tokenId: string }> }) {
  try {
    const { id, tokenId } = await params
    const body = await request.json()
    const result = await updatePassportTokenAction(tokenId, id, body)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; tokenId: string }> }) {
  try {
    const { id, tokenId } = await params
    const result = await deletePassportTokenAction(tokenId, id)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}