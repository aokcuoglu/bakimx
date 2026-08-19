import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-errors"
import { prisma } from "@/lib/db"
import { getVapidConfig } from "@/lib/push/config"
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validations/push"

/**
 * Teknisyen Web Push abonelik ucu (BAK-129, Faz B).
 *
 * GET    — istemcinin ihtiyacı olan çalışma-zamanı yapılandırması (VAPID açık
 *          anahtarı). Anahtar SSM'den runtime env olarak geldiği için
 *          `NEXT_PUBLIC_*` ile build'e gömülemez.
 * POST   — aboneliği kaydeder/günceller.
 * DELETE — aboneliği siler ("Bildirimleri kapat").
 *
 * Kimlik yalnız OTURUMDAN gelir; gövdedeki hiçbir alan kiracı/kullanıcı
 * belirlemez. `/api/technician/*` middleware'de zaten korumalı prefix.
 */
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

export async function GET() {
  try {
    await requireAuth()
    const vapid = getVapidConfig()
    return NextResponse.json(
      { configured: vapid !== null, publicKey: vapid?.publicKey ?? null },
      { headers: NO_STORE },
    )
  } catch (err) {
    return apiErrorResponse(err)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (!getVapidConfig()) {
      return NextResponse.json({ error: "Push bildirimleri bu ortamda yapılandırılmamış" }, { status: 503 })
    }

    const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz abonelik" }, { status: 400 })
    }

    const { endpoint, keys } = parsed.data

    // `endpoint` global benzersiz: aynı tarayıcı ikinci kez abone olursa satır
    // GÜNCELLENİR. Ortak kullanılan bir cihazda yeni oturum aboneliği devralır —
    // sahiplik `userId`/`workshopId` ile birlikte yeniden yazıldığı için eski
    // kullanıcının atölyesine ait bir bildirim o cihaza bir daha gitmez.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        workshopId: user.workshopId,
        userId: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
      },
      create: {
        workshopId: user.workshopId,
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
      },
    })

    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (err) {
    return apiErrorResponse(err)
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()

    const parsed = pushUnsubscribeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz abonelik" }, { status: 400 })
    }

    // Kiracı izolasyonu: yalnız KENDİ aboneliğini silebilir.
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: user.id, workshopId: user.workshopId },
    })

    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (err) {
    return apiErrorResponse(err)
  }
}
