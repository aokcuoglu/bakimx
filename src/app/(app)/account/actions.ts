"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { rateLimit } from "@/lib/rate-limit"
import { changePasswordSchema } from "@/lib/validations/auth"

type Result = { ok: true } | { ok: false; error: string }

/** Mevcut şifre denemesi için üst sınır — panelden şifre kırma denemesini keser. */
const MAX_ATTEMPTS = 10
const ATTEMPT_WINDOW_MS = 15 * 60_000

/**
 * Kullanıcının kendi şifresini değiştirmesi (BAK-37).
 *
 * Geçici şifreyle açılmış hesabın kilidini açan TEK yol budur: sahip ekip
 * panelinden şifre üretir, kullanıcı onunla girer ve `(app)/layout.tsx` onu
 * doğrudan bu forma düşürür.
 *
 * `requireWritableWorkshop` kapısından BİLEREK geçmez:
 *  - kapı `mustChangePassword` dolu olan kullanıcıyı reddediyor (bkz.
 *    `assertPasswordChanged`), yani bu action oradan geçseydi kullanıcı kilidi
 *    hiç açamazdı — sonsuz döngü;
 *  - kendi şifresini değiştirmek bir izin (`Permission`) gerektirmez, her rol
 *    yapabilmeli;
 *  - plan kilidi altındaki bir hesabın da şifresini değiştirebilmesi doğru
 *    davranış (kimlik işlemi, kiracı verisi mutasyonu değil).
 * Bu muafiyet `src/lib/rbac-coverage.test.ts` ALLOWLIST'inde gerekçesiyle kayıtlı.
 */
export async function changeOwnPasswordAction(formData: FormData): Promise<Result> {
  const user = await requireAuth()

  if (!rateLimit(`pwchange:${user.id}`, MAX_ATTEMPTS, ATTEMPT_WINDOW_MS).allowed) {
    return { ok: false, error: "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin." }
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgiler" }
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  })
  if (!record) return { ok: false, error: "Hesabınız bulunamadı." }

  if (!(await bcrypt.compare(parsed.data.currentPassword, record.password))) {
    return { ok: false, error: "Mevcut şifreniz hatalı." }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: passwordHash, mustChangePassword: false },
  })

  // Şifrenin kendisi DEĞİL, yalnızca olayın olduğu kaydedilir.
  await AuditLogAction(user.workshopId, user.id, "User", user.id, "password_changed")

  // Kapı `(app)/layout.tsx`'te oturum kullanıcısından okunuyor — önbellek
  // temizlenmezse kullanıcı şifreyi değiştirdiği hâlde aynı ekranda kalır.
  revalidatePath("/", "layout")
  return { ok: true }
}

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "Ad gerekli").max(50),
  lastName: z.string().min(1, "Soyad gerekli").max(50),
})

export async function updateOwnProfileAction(formData: FormData): Promise<Result> {
  const user = await requireAuth()

  const parsed = updateProfileSchema.safeParse({
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgiler" }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "User", user.id, "profile_updated")

  revalidatePath("/", "layout")
  return { ok: true }
}
