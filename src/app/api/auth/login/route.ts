import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { loginSchema } from "@/lib/validation"
import { getSession } from "@/lib/session"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const raw = {
      email: (formData.get("email") as string || "").trim().toLowerCase(),
      password: formData.get("password") as string,
    }

    const parsed = loginSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (!user) {
      return NextResponse.json(
        { error: "E-posta adresi veya şifre hatalı" },
        { status: 400 }
      )
    }

    const valid = await bcrypt.compare(parsed.data.password, user.password)
    if (!valid) {
      return NextResponse.json(
        { error: "E-posta adresi veya şifre hatalı" },
        { status: 400 }
      )
    }

    const workshop = await prisma.workshop.findUnique({ where: { id: user.workshopId } })
    if (!workshop) {
      return NextResponse.json(
        { error: "Hesabınıza bağlı iş yeri bulunamadı. Lütfen destek ile iletişime geçin." },
        { status: 400 }
      )
    }

    const session = await getSession()
    session.userId = user.id
    session.workshopId = user.workshopId
    await session.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Login handler error:", error)
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}