import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { readVerifyToken } from "@/lib/billing/verify-token"
import { activateVerifiedWorkshop } from "@/lib/billing/verify-activation"
import { getSession } from "@/lib/session"

/**
 * E-posta doğrulama linki (public, GET). Token → workshopId → trial'ı başlat
 * (activateVerifiedWorkshop; idempotent + claim-guard'lı) → owner için oturum aç
 * → /dashboard. Token/workshop geçersizse /login?verify=invalid.
 *
 * Not: GET link e-posta tarayıcı prefetch'ine açıktır — prefetch trial'ı erken
 * aktifleştirebilir (idempotent, zararsız) ve oturum çerezini bota yazar. Gerçek
 * kullanıcı tıkladığında aktivasyon idempotent, oturum yine ONUN çerezine gider.
 */
function appOrigin(request: Request): string {
  return process.env.APP_URL || new URL(request.url).origin
}

export async function GET(request: Request): Promise<Response> {
  const origin = appOrigin(request)
  const token = new URL(request.url).searchParams.get("token")
  const workshopId = token ? readVerifyToken(token) : null
  if (!workshopId) {
    return NextResponse.redirect(new URL("/login?verify=invalid", origin))
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true },
  })
  if (!workshop) {
    return NextResponse.redirect(new URL("/login?verify=invalid", origin))
  }

  // pending→approved bir kez yan-etki üretir; zaten approved ise ok:true (idempotent).
  const activation = await activateVerifiedWorkshop(workshopId)
  if (!activation.ok) {
    return NextResponse.redirect(new URL("/login?verify=error", origin))
  }

  const owner = await prisma.user.findFirst({
    where: { workshopId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!owner) {
    // Aktivasyon başarılı ama owner bulunamadı (imkansıza yakın) — girişe düş.
    return NextResponse.redirect(new URL("/login?verify=1", origin))
  }

  // Oturum aç (login route ile aynı desen): önce temizle, sonra kimliği yaz.
  const session = await getSession()
  session.destroy()
  session.userId = owner.id
  session.workshopId = workshopId
  await session.save()

  return NextResponse.redirect(new URL("/dashboard", origin))
}
