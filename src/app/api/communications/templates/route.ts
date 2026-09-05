import { requireFeatureWorkshop } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-errors"
import { NextResponse } from "next/server"
import { saveNotificationTemplateAction, resetNotificationTemplateAction } from "@/app/(app)/settings/notifications/actions"

export async function POST(request: Request) {
  try {
    await requireFeatureWorkshop("automatedReminders")
    const formData = await request.formData()
    const result = await saveNotificationTemplateAction(formData)
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    await requireFeatureWorkshop("automatedReminders")
    const formData = await request.formData()
    const result = await resetNotificationTemplateAction(formData)
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
