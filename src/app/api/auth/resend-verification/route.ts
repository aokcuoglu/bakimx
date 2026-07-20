import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { sendVerifyEmail } from "@/lib/billing/verify-email"

/**
 * Doğrulama e-postasını yeniden yollar. Kilit ekranından (pending kullanıcı giriş
 * yapıp uygulamaya gelince) çağrılır. workshopId SESSION'dan türetilir (client
 * param'a güvenilmez). Yalnız pending + trialsız workshop için gönderir; aksi
 * halde sessiz başarı (durum sızdırmadan). IP+workshop başına rate-limit.
 */
const RL_MAX = 3
const RL_WINDOW_MS = 10 * 60_000

export async function POST(request: Request): Promise<Response> {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 })
  }

  const ip = clientIpFromHeaders(request.headers)
  const limit = rateLimit(`resend-verify:${user.workshopId}:${ip}`, RL_MAX, RL_WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen birkaç dakika sonra tekrar deneyin." },
      { status: 429 },
    )
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: { approvalStatus: true, trialStartedAt: true },
  })
  // Yalnız hâlâ doğrulanmamış (pending + trialsız) kayıt için yeniden yolla.
  if (workshop?.approvalStatus === "pending" && workshop.trialStartedAt === null) {
    await sendVerifyEmail(user.workshopId)
  }
  return NextResponse.json({ ok: true })
}
