import { addDamageMarkAction, removeDamageMarkAction, listDamageMarksAction, updateDamageMarkAction, updateDamageInspectionAction } from "@/app/(app)/intakes/actions"
import { apiErrorResponse } from "@/lib/api-errors"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const result = await addDamageMarkAction(await request.json())
    return result.error ? NextResponse.json(result, { status: "forbidden" in result && result.forbidden ? 403 : 400 }) : NextResponse.json(result)
  } catch (error) { return apiErrorResponse(error) }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Hasar kaydı seçilmedi" }, { status: 400 })
    const result = await removeDamageMarkAction(id)
    return result.error ? NextResponse.json(result, { status: "forbidden" in result && result.forbidden ? 403 : 400 }) : NextResponse.json(result)
  } catch (error) { return apiErrorResponse(error) }
}

export async function GET(request: Request) {
  try {
    const result = await listDamageMarksAction(new URL(request.url).searchParams.get("intakeFormId") || "")
    return NextResponse.json(result, { status: result.error ? ("forbidden" in result && result.forbidden ? 403 : 404) : 200, headers: { "Cache-Control": "no-store" } })
  } catch (error) { return apiErrorResponse(error) }
}
export async function PATCH(request: Request) {
  try {
    const input = await request.json()
    const result = input.id ? await updateDamageMarkAction(input) : await updateDamageInspectionAction(input)
    return NextResponse.json(result, { status: result.error ? ("forbidden" in result && result.forbidden ? 403 : 400) : 200 })
  } catch (error) { return apiErrorResponse(error) }
}
