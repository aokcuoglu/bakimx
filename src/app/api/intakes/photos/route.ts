import { addPhotoAction, removePhotoAction, replacePhotoAction } from "@/app/(app)/intakes/actions"
import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await addPhotoAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: result.id })
  } catch (err) {
    return apiErrorResponse(err)
  }
}

export async function PUT(request: Request) {
  try {
    const formData = await request.formData()
    const result = await replacePhotoAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiErrorResponse(err)
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Parametreler eksik" }, { status: 400 })
    }
    const result = await removePhotoAction(id)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiErrorResponse(err)
  }
}