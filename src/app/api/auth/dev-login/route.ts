import { NextResponse } from "next/server"
import { establishSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { isDevLoginAllowed, parseDevLoginTarget, safeRedirectPath } from "@/lib/dev-login"
import { resolveWorkshopIdByLoginCode } from "@/lib/auth-login"
import { resolveSessionSurface } from "@/lib/sales/session-surface"

/**
 * Yerel QA oturum kısayolu — parola girmeden seed kullanıcısıyla oturum açar.
 *
 *   GET /api/auth/dev-login?email=admin@bakimx.com&redirect=/technician
 *   GET /api/auth/dev-login?username=<kullanici>&code=<giriş kodu>&redirect=/technician
 *
 * İkinci biçim e-postasız (yalnız kullanıcı adlı) teknisyenler içindir;
 * gerçek girişteki gibi iş yeri kodu + kullanıcı adıyla çözülür.
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
  const target = parseDevLoginTarget(url.searchParams)
  if (target.kind === "invalid") {
    return NextResponse.json({ error: target.error }, { status: 400 })
  }

  let user: { id: string; workshopId: string; role: string } | null
  let label: string
  if (target.kind === "username") {
    label = `${target.username} @ ${target.workshopCode}`
    const workshopId = await resolveWorkshopIdByLoginCode(target.workshopCode)
    user = workshopId
      ? await prisma.user.findFirst({
          where: { workshopId, username: target.username, isActive: true },
          select: { id: true, workshopId: true, role: true },
        })
      : null
  } else {
    label = target.email
    user = await prisma.user.findFirst({
      where: { email: target.email, isActive: true },
      select: { id: true, workshopId: true, role: true },
    })
  }
  if (!user) {
    return NextResponse.json(
      { error: `Kullanıcı bulunamadı: ${label}. Önce 'bun run db:seed' çalıştırın.` },
      { status: 404 }
    )
  }

  const surface = await resolveSessionSurface(user.id, user.workshopId)
  await establishSession(user.id, user.workshopId, user.role, "development", surface)

  return NextResponse.redirect(
    new URL(safeRedirectPath(url.searchParams.get("redirect"), surface === "sales" ? "/admin/sales" : "/dashboard"), request.url)
  )
}
