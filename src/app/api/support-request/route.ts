import { NextResponse } from "next/server"

interface SupportRequestBody {
  name: string
  businessName: string
  email: string
  phone: string
  subject: string
  message: string
}

function validateBody(body: SupportRequestBody): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!body.name || body.name.trim().length < 2) {
    errors.name = "Ad Soyad en az 2 karakter olmalıdır"
  }

  if (!body.businessName || body.businessName.trim().length < 2) {
    errors.businessName = "İşletme adı en az 2 karakter olmalıdır"
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.email = "Geçerli bir e-posta adresi girin"
  }

  if (!body.phone || !/^[0-9+\-\s()]{7,15}$/.test(body.phone.trim())) {
    errors.phone = "Geçerli bir telefon numarası girin"
  }

  if (!body.message || body.message.trim().length < 10) {
    errors.message = "Mesaj en az 10 karakter olmalıdır"
  }

  return errors
}

export async function POST(request: Request) {
  try {
    const body: SupportRequestBody = await request.json()

    const validationErrors = validateBody(body)

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { success: false, errors: validationErrors },
        { status: 400 }
      )
    }

    console.log("[support-request] New support request:", {
      name: body.name,
      businessName: body.businessName,
      email: body.email,
      phone: body.phone,
      subject: body.subject,
      message: body.message,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        success: true,
        message: "Talebiniz başarıyla alındı. Ekibimiz sizinle en kısa sürede iletişime geçecektir.",
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { success: false, errors: { _general: "Geçersiz istek formatı" } },
      { status: 400 }
    )
  }
}
