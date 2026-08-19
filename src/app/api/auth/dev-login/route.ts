import { NextResponse } from "next/server"
import { establishSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { isDevLoginAllowed, safeRedirectPath } from "@/lib/dev-login"

/**
 * Yerel QA oturum kısayolu — parola girmeden seed kullanıcısıyla oturum açar.
 *
 *   GET /api/auth/dev-login?email=admin@bakimx.com&redirect=/technician
 *
 * İzole worktree'lerde tarayıcı QA'si için var: her seferinde geçici bir
 * route yazmak yerine tek, denetlenmiş ve testli bir kapı. Yalnızca
 * `NODE_ENV=development` + localhost'ta çalışır (bkz. isDevLoginAllowed);
 * prod imajında 404'tür. Parola doğrulaması YAPMAZ, bu yüzden gerçek giriş
 * akışının yerine geçmez — /api/auth/login değişmedi.
 */
export async function GET(request: Request) {
  if (!isDevLoginAllowed(process.env.NODE_ENV, request.headers.get("host"))) {
    return new NextResponse(null, { status: 404 })
  }

  const url = new URL(request.url)
  const email = (url.searchParams.get("email") || "admin@bakimx.com").trim().toLowerCase()

  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    select: { id: true, workshopId: true, role: true },
  })
  if (!user) {
    return NextResponse.json(
      { error: `Kullanıcı bulunamadı: ${email}. Önce 'bun run db:seed' çalıştırın.` },
      { status: 404 }
    )
  }

  await establishSession(user.id, user.workshopId, user.role, "development")

  return NextResponse.redirect(
    new URL(safeRedirectPath(url.searchParams.get("redirect")), request.url)
  )
}
