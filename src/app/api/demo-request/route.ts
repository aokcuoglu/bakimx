import { NextResponse } from "next/server";

interface DemoRequestBody {
  name: string;
  businessName: string;
  phone: string;
  city: string;
  monthlyVehicles: string;
  notes?: string;
}

function validateBody(body: DemoRequestBody): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!body.name || body.name.trim().length < 2) {
    errors.name = "Ad Soyad en az 2 karakter olmalıdır";
  }

  if (!body.businessName || body.businessName.trim().length < 2) {
    errors.businessName = "İşletme adı en az 2 karakter olmalıdır";
  }

  if (!body.phone || !/^[0-9+\-\s()]{7,15}$/.test(body.phone.trim())) {
    errors.phone = "Geçerli bir telefon numarası girin";
  }

  if (!body.city || body.city.trim().length === 0) {
    errors.city = "Şehir seçimi yapın";
  }

  if (!body.monthlyVehicles || body.monthlyVehicles.trim().length === 0) {
    errors.monthlyVehicles = "Aylık araç adedi seçin";
  }

  return errors;
}

export async function POST(request: Request) {
  try {
    const body: DemoRequestBody = await request.json();

    const validationErrors = validateBody(body);

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { success: false, errors: validationErrors },
        { status: 400 }
      );
    }

    // TODO: Persist to database when DATABASE_URL is available
    // Example: await prisma.demoRequest.create({ data: { ...body } })
    // For now, we log and return success

    console.log("[demo-request] New demo request:", {
      name: body.name,
      businessName: body.businessName,
      phone: body.phone,
      city: body.city,
      monthlyVehicles: body.monthlyVehicles,
      notes: body.notes || "",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Demo talebiniz başarıyla alındı. En kısa sürede sizinle iletişime geçeceğiz.",
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, errors: { _general: "Geçersiz istek formatı" } },
      { status: 400 }
    );
  }
}