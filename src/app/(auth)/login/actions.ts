"use server"

import { prisma } from "@/lib/db"
import { loginSchema, registerSchema } from "@/lib/validation"
import { getSession } from "@/lib/session"
import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"

export async function registerAction(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    workshopName: formData.get("workshopName") as string,
    phone: formData.get("phone") as string,
    city: formData.get("city") as string,
    address: formData.get("address") as string,
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Geçersiz bilgiler"
    return { error: firstError }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { error: "Bu e-posta adresi zaten kayıtlı" }
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12)

  const workshop = await prisma.workshop.create({
    data: {
      name: parsed.data.workshopName,
      phone: parsed.data.phone,
      city: parsed.data.city,
      address: parsed.data.address,
    },
  })

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      password: hashedPassword,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      workshopId: workshop.id,
    },
  })

  const session = await getSession()
  session.userId = user.id
  session.workshopId = user.workshopId
  await session.save()

  redirect("/app")
}

export async function loginAction(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!user) {
    return { error: "E-posta veya şifre hatalı" }
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password)
  if (!valid) {
    return { error: "E-posta veya şifre hatalı" }
  }

  const session = await getSession()
  session.userId = user.id
  session.workshopId = user.workshopId
  await session.save()

  redirect("/app")
}

export async function logoutAction() {
  const session = await getSession()
  session.destroy()
  redirect("/login")
}