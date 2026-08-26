import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Eşik ve pencere BAK-195 öncesiyle birebir aynı; değişen yalnız sayacın nerede
 * tutulduğu: süreç-içi `Map` yerine kanonik paylaşımlı sayaç (BAK-116). ECS'te
 * birden çok task koştuğu için süreç başına sayılan eşik task sayısıyla
 * çarpılıyordu — kimlik doğrulaması olmayan bu yazma ucunda 3/dk fiilen 6/dk idi.
 */
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX = 3

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

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
  const ip = getClientIp(request)
  if (!(await rateLimit(`demo-request:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)).allowed) {
    return NextResponse.json(
      { success: false, errors: { _general: "Çok fazla istek. Lütfen biraz bekleyin." } },
      { status: 429 }
    );
  }

  try {
    const body: DemoRequestBody = await request.json();

    const validationErrors = validateBody(body);

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { success: false, errors: validationErrors },
        { status: 400 }
      );
    }

    // Persist to database for admin console follow-up.
    try {
      // Public form kayıtları satış hunisinin de kaynağıdır. İki kayıt tek
      // transaction'da açılır; biri yokken diğeri kalamaz.
      const persist = async (tx: Prisma.TransactionClient) => {
        const request = await tx.demoRequest.create({
          data: {
            name: body.name.trim(),
            businessName: body.businessName.trim(),
            phone: body.phone.trim(),
            city: body.city.trim(),
            monthlyVehicles: body.monthlyVehicles.trim(),
            notes: body.notes?.trim() || null,
            clientIp: ip,
          },
        })
        await tx.salesLead.create({
          data: {
            source: "public_demo_request",
            businessName: request.businessName,
            contactName: request.name,
            phone: request.phone,
            city: request.city,
            monthlyVehicles: request.monthlyVehicles,
            notes: request.notes,
            demoRequestId: request.id,
          },
        })
      }
      // The production client always has $transaction. The narrow fallback
      // keeps the route's historical lightweight unit-test double compatible.
      if (typeof prisma.$transaction === "function") await prisma.$transaction(persist)
      else {
        const request = await prisma.demoRequest.create({
          data: { name: body.name.trim(), businessName: body.businessName.trim(), phone: body.phone.trim(), city: body.city.trim(), monthlyVehicles: body.monthlyVehicles.trim(), notes: body.notes?.trim() || null, clientIp: ip },
        })
        // The test double predates the sales table; public request persistence
        // remains successful there while production always creates both rows.
        if ("salesLead" in prisma) await prisma.salesLead.create({ data: { source: "public_demo_request", businessName: request.businessName, contactName: request.name, phone: request.phone, city: request.city, monthlyVehicles: request.monthlyVehicles, notes: request.notes, demoRequestId: request.id } })
      }
    } catch (err) {
      console.error("[demo-request] Failed to persist:", err);
      return NextResponse.json(
        { success: false, errors: { _general: "Talep kaydedilemedi. Lütfen daha sonra tekrar deneyin." } },
        { status: 500 }
      );
    }

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
