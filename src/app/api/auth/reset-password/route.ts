import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { resetPasswordSchema } from "@/lib/validations/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { hashResetToken, isResetExpired } from "@/lib/password-reset"

const INVALID_MESSAGE = "Sıfırlama bağlantısı geçersiz veya süresi dolmuş."

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)
  const limit = rateLimit(`pwreset-confirm-ip:${ip}`, 10, 15 * 60 * 1000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin." },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }

  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz istek." },
      { status: 400 },
    )
  }

  const tokenHash = hashResetToken(parsed.data.token)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!record || record.usedAt || isResetExpired(record.expiresAt)) {
    return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const claimed = await prisma.$transaction(async (tx) => {
    const consume = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (consume.count === 0) return false // already consumed by a concurrent request
    await tx.user.update({
      where: { id: record.userId },
      data: {
        password: passwordHash,
        // Kullanıcı şifresini kendi belirledi — geçici şifre kapısı burada da
        // düşmeli, yoksa sıfırlamadan sonra hâlâ değiştirme ekranında kalır (BAK-37).
        mustChangePassword: false,
      },
    })
    return true
  })

  if (!claimed) {
    return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
