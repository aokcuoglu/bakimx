import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const submissionCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX = 3

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = submissionCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    submissionCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return false
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) return true
  return false
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
  if (isRateLimited(ip)) {
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
      await prisma.demoRequest.create({
        data: {
          name: body.name.trim(),
          businessName: body.businessName.trim(),
          phone: body.phone.trim(),
          city: body.city.trim(),
          monthlyVehicles: body.monthlyVehicles.trim(),
          notes: body.notes?.trim() || null,
          clientIp: ip,
        },
      });
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