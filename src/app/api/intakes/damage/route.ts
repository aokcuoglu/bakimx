import { addDamageMarkAction, removeDamageMarkAction } from "@/app/(app)/intakes/actions"
import { apiErrorResponse } from "@/lib/api-errors"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const result = await addDamageMarkAction(await request.json())
    return result.error ? NextResponse.json(result, { status: 400 }) : NextResponse.json(result)
  } catch (error) { return apiErrorResponse(error) }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Hasar kaydı seçilmedi" }, { status: 400 })
    const result = await removeDamageMarkAction(id)
    return result.error ? NextResponse.json(result, { status: 400 }) : NextResponse.json(result)
  } catch (error) { return apiErrorResponse(error) }
}
