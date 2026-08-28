import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { registerSchema } from "@/lib/validations/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { getAdminEmails } from "@/lib/admin"
import { newApplicationAdminEmail } from "@/lib/emails/system-emails"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { canResumeVerification } from "@/lib/billing/verify-resume"
import { sendVerifyEmail } from "@/lib/billing/verify-email"
import {
  hashSalesRegistrationToken,
  salesRegistrationLinkState,
} from "@/lib/sales/registration-link"
import { isLoginCodeConflict, workshopCodeCandidate } from "@/lib/workshop-code"

/**
 * Self-serve workshop registration (email-verification gated trial).
 *
 * Creates a new isolated Workshop + its first owner User in `pending` status
 * with NO trial started yet — the 7-business-day trial begins only after the owner
 * verifies their e-mail address (see activateVerifiedWorkshop). The welcome
 * e-mail also moved there (single-send). This route sends a verification
 * e-mail via `sendVerifyEmail` and returns `{ ok: true }`; no token is
 * returned in the response and no session is created here.
 */

const REGISTER_MAX_ATTEMPTS = 5
const REGISTER_WINDOW_MS = 10 * 60_000 // 10 minutes
/** İş yeri giriş kodu çakışmasında kaç kez yeni aday denenir (BAK-40). */
const MAX_LOGIN_CODE_RETRIES = 5

const GENERIC_ERROR = "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin."
const EMAIL_IN_USE_ERROR = "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin."
const EMAIL_SEND_ERROR = "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin."

class SalesRegistrationError extends Error {}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)
  const limit = await rateLimit(`register:${ip}`, REGISTER_MAX_ATTEMPTS, REGISTER_WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin." },
      { status: 429 }
    )
  }

  // Accept both multipart/form-data (from the register form) and JSON.
  let raw: Record<string, unknown>
  try {
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      raw = (await request.json()) as Record<string, unknown>
    } else {
      const form = await request.formData()
      raw = Object.fromEntries(form.entries())
    }
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  // Danışman atfı yalnız opak satış kayıt token'ından çözülür. Eski veya sahte
  // istemcilerin ham advisor kimliği göndermesi sessizce kabul edilmez.
  if (typeof raw.acquisitionAdvisorId === "string" && raw.acquisitionAdvisorId.trim()) {
    return NextResponse.json(
      { error: "Satış danışmanı atfı yalnız güvenli kayıt bağlantısıyla yapılabilir." },
      { status: 400 },
    )
  }

  const normalized = {
    ...raw,
    email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : raw.email,
  }

  const parsed = registerSchema.safeParse(normalized)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" },
      { status: 400 }
    )
  }

  const data = parsed.data
  const salesRegistrationTokenHash = data.salesRegistrationToken
    ? hashSalesRegistrationToken(data.salesRegistrationToken)
    : null

  // Existing e-mail: either an AUTH-BOUNDED resume of an interrupted registration
  // or the ordinary "e-posta kullanımda" rejection. RESUME only when the supplied
  // password verifies against the stored hash (same bcrypt.compare login uses) AND
  // the workshop is still pending with no trial started — otherwise the generic
  // rejection (wrong password is indistinguishable from a non-resumable account,
  // so there is no account-takeover path).
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: {
      password: true,
      workshop: { select: { id: true, approvalStatus: true, trialStartedAt: true } },
    },
  })
  if (existing) {
    const passwordValid = await bcrypt.compare(data.password, existing.password)
    if (
      canResumeVerification({
        passwordValid,
        approvalStatus: existing.workshop.approvalStatus,
        trialStartedAt: existing.workshop.trialStartedAt,
      })
    ) {
      const sent = await sendVerifyEmail(existing.workshop.id)
      if (!sent.ok) {
        return NextResponse.json({ error: EMAIL_SEND_ERROR }, { status: 500 })
      }
      return NextResponse.json({ ok: true, resumed: true })
    }
    return NextResponse.json({ error: EMAIL_IN_USE_ERROR }, { status: 409 })
  }

  // Referans kodu yalnız yeni kayıt için çözülür. Yarım kalmış bir kaydın
  // doğrulama e-postasını yeniden gönderen resume yolu, sonradan girilen başka
  // bir kodla mevcut atfı değiştiremez.
  const referrerWorkshop = !salesRegistrationTokenHash && data.referralCode
    ? await prisma.workshop.findUnique({
        where: { referralCode: data.referralCode },
        select: { id: true },
      })
    : null
  if (!salesRegistrationTokenHash && data.referralCode && !referrerWorkshop) {
    return NextResponse.json({ error: "Referans kodu geçerli değil." }, { status: 400 })
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 12)

    // İş yeri giriş kodu çakışırsa (aynı isimli ikinci atölye) sonraki adayla
    // sınırlı sayıda yeniden dene — checkout'takiyle aynı P2002 deseni.
    const createWorkshopWithLoginCode = async () => {
      // Parse working days for settings
      const workingDaysArr = data.workingDays
        ? data.workingDays.split(",").map((d) => parseInt(d, 10))
        : [1, 2, 3, 4, 5, 6]
      const weekdayDays = workingDaysArr.filter((d) => d >= 1 && d <= 5).join(",")
      const weekendDays = workingDaysArr.filter((d) => d === 0 || d === 6).join(",")

      for (let attempt = 0; attempt < MAX_LOGIN_CODE_RETRIES; attempt++) {
        const loginCode = workshopCodeCandidate(data.workshopName, attempt)
        try {
          return await prisma.$transaction(async (tx) => {
            const conversionAt = new Date()
            const salesLink = salesRegistrationTokenHash
              ? await tx.salesRegistrationLink.findUnique({
                  where: { tokenHash: salesRegistrationTokenHash },
                  select: {
                    id: true,
                    advisorId: true,
                    createdById: true,
                    expiresAt: true,
                    usedAt: true,
                    revokedAt: true,
                    lead: {
                      select: {
                        id: true,
                        source: true,
                        status: true,
                        advisorId: true,
                        workshopId: true,
                        attributionFrozenAt: true,
                      },
                    },
                    advisor: {
                      select: { disabledAt: true, user: { select: { isActive: true } } },
                    },
                  },
                })
              : null

            if (salesRegistrationTokenHash) {
              if (!salesLink || salesRegistrationLinkState(salesLink, conversionAt) !== "active") {
                throw new SalesRegistrationError("Bu kayıt bağlantısı artık geçerli değil.")
              }
              if (salesLink.advisor.disabledAt || !salesLink.advisor.user.isActive) {
                throw new SalesRegistrationError("Bu kayıt bağlantısı artık etkin bir danışmana bağlı değil.")
              }
              if (
                salesLink.lead.advisorId !== salesLink.advisorId ||
                salesLink.lead.workshopId ||
                salesLink.lead.attributionFrozenAt ||
                ["won", "lost"].includes(salesLink.lead.status)
              ) {
                throw new SalesRegistrationError("Satış adayı değiştiği için bu kayıt bağlantısı artık kullanılamaz.")
              }

              // Koşullu tüketim eşzamanlı iki POST'tan yalnız birini içeri alır.
              // Transaction daha sonra başarısız olursa bu işaret de geri alınır.
              const claimed = await tx.salesRegistrationLink.updateMany({
                where: {
                  id: salesLink.id,
                  usedAt: null,
                  revokedAt: null,
                  expiresAt: { gt: conversionAt },
                },
                data: { usedAt: conversionAt },
              })
              if (claimed.count !== 1) {
                throw new SalesRegistrationError("Bu kayıt bağlantısı başka bir işlem tarafından kullanıldı.")
              }
            }

            const ws = await tx.workshop.create({
              data: {
                loginCode,
                name: data.workshopName,
                phone: data.phone,
                city: data.city,
                district: data.district || null,
                address: data.address,
                email: data.workshopEmail || data.email,
                taxOffice: data.taxOffice || null,
                taxNumber: data.taxNumber || null,
                invoiceTitle: data.invoiceTitle || data.workshopName,
                onboardingProfile: {
                  sector: data.sector,
                  businessFeatures: data.businessFeatures,
                  teamSize: data.teamSize,
                  selectedModules: data.selectedModules,
                  setupPreference: data.setupPreference,
                },
                // Approval-gated trial: pending until the e-mail is verified. The trial
                // (trialStartedAt/EndsAt) starts in activateVerifiedWorkshop, not here.
                approvalStatus: "pending",
                subscriptionStatus: "trialing",
                trialStartedAt: null,
                trialEndsAt: null,
                planTier: "pro",
                acquisitionSource: salesLink ? "sales_advisor" : referrerWorkshop ? "referral" : data.acquisitionSource,
                acquisitionAdvisorId: salesLink?.advisorId ?? null,
                referredByWorkshopId: referrerWorkshop?.id ?? null,
                referralCodeUsed: salesLink ? null : data.referralCode || null,
                settings: {
                  create: {
                    weekdayStart: data.weekdayStart || "09:00",
                    weekdayEnd: data.weekdayEnd || "18:00",
                    weekdayWorkingDays: weekdayDays || "1,2,3,4,5",
                    weekendStart: data.weekdayStart || "09:00",
                    weekendEnd: data.weekdayEnd || "18:00",
                    weekendWorkingDays: weekendDays || "",
                  },
                },
              },
            })

            const ownerTechnician = await tx.technician.create({
              data: {
                workshopId: ws.id,
                fullName: `${data.firstName} ${data.lastName}`.trim(),
                phone: data.phone,
                role: "yonetici",
              },
            })
            await tx.user.create({
              data: {
                email: data.email,
                password: passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                workshopId: ws.id,
                // The self-serve registrant is the workshop's first user → owner.
                role: "owner",
                technicianId: ownerTechnician.id,
              },
            })

            if (salesLink) {
              const converted = await tx.salesLead.updateMany({
                where: {
                  id: salesLink.lead.id,
                  advisorId: salesLink.advisorId,
                  workshopId: null,
                  attributionFrozenAt: null,
                  status: { notIn: ["won", "lost"] },
                },
                data: {
                  workshopId: ws.id,
                  status: "won",
                  attributionFrozenAt: conversionAt,
                  nextActionAt: null,
                  lostReason: null,
                },
              })
              if (converted.count !== 1) {
                throw new SalesRegistrationError("Satış adayı başka bir işlem tarafından dönüştürüldü.")
              }
              await tx.salesTask.updateMany({
                where: { leadId: salesLink.lead.id, status: "scheduled" },
                data: { status: "cancelled", resolvedAt: conversionAt },
              })
              await tx.salesActivity.create({
                data: {
                  leadId: salesLink.lead.id,
                  type: "note",
                  result: "won",
                  summary: "Müşteri güvenli kayıt bağlantısıyla hesabını oluşturdu.",
                  occurredAt: conversionAt,
                  createdById: salesLink.createdById,
                },
              })
              if (salesLink.lead.source === "customer_referral") {
                await tx.salesReferral.updateMany({
                  where: { leadId: salesLink.lead.id },
                  data: { status: "won" },
                })
              }
              await tx.salesRegistrationLink.update({
                where: { id: salesLink.id },
                data: { workshopId: ws.id },
              })
            }

            return ws
          })
        } catch (err) {
          if (isLoginCodeConflict(err)) continue
          throw err // e-posta çakışması dâhil diğer her şey dış catch'e
        }
      }
      return null
    }

    const workshop = await createWorkshopWithLoginCode()
    if (!workshop) {
      console.error("[register] login code generation exhausted for:", data.workshopName)
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
    }

    // Doğrulama e-postası — akışın kilit taşı. Workshop+User zaten commit edildi;
    // gönderim başarısızsa 500 döner ve kullanıcı aynı bilgilerle tekrar POST edince
    // resume yolu (pending + trialsız) linki yeniden yollar (veri kaybı yok).
    const sent = await sendVerifyEmail(workshop.id)

    // Best-effort admin bildirimi — hata kayıt sonucunu etkilemez. Karşılama
    // e-postası BURADA DEĞİL, e-posta doğrulaması başarıya ulaştığında
    // activateVerifiedWorkshop içinde tek sefer gönderilir (çifte gönderim yok).
    try {
      const adminMail = newApplicationAdminEmail({
        workshopName: data.workshopName,
        ownerName: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        phone: data.phone,
        city: data.city,
      })
      await Promise.allSettled(
        getAdminEmails().map((to) =>
          sendSystemEmail({
            to,
            subject: adminMail.subject,
            html: adminMail.html,
            workshopId: workshop.id,
            templateKey: "new_application_admin",
            // Alıcı platform yöneticisi — kayıt yeni kiracının workshopId'siyle
            // tutulur ama onun ekranında GÖRÜNMEZ (issue #194).
            audience: "internal",
          }),
        ),
      )
    } catch (mailErr) {
      console.error("[register] notification failed:", mailErr instanceof Error ? mailErr.message : mailErr)
    }

    if (!sent.ok) {
      return NextResponse.json({ error: EMAIL_SEND_ERROR }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof SalesRegistrationError) {
      return NextResponse.json({ error: err.message }, { status: 410 })
    }
    // Unique-constraint race (duplicate e-mail) or any other failure.
    const code = (err as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json({ error: EMAIL_IN_USE_ERROR }, { status: 409 })
    }
    console.error("[register] failed:", err)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
