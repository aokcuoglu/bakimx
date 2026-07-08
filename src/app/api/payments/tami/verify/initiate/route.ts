import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { getTamiClient } from "@/lib/tami"
import { isTamiConfigured } from "@/lib/tami/config"
import { alertTamiMisconfigOnce, isCardPaymentBlocked } from "@/lib/tami/misconfig-alert"
import { TamiError, sanitizeForLog } from "@/lib/tami/errors"
import { buildTamiPaymentBody } from "@/lib/tami/request-builder"
import { cardSchema } from "@/lib/billing/card-schema"
import { createVerifyToken, readVerifyToken } from "@/lib/billing/verify-token"
import { generateProviderOrderId, resolveClientIp, splitName } from "@/lib/billing/payment-helpers"

/**
 * Kart doğrulama 3DS başlatma (PRE-AUTH, 1 TL). Native HTML form POST alır:
 * `vtoken` (imzalı verify token) + kart alanları. Satış initiate'iyle AYNI bariyer:
 *  - kart verisi YALNIZ bellekte; hiçbir log/DB/hata nesnesine düz metin girmez.
 *  - tutar SUNUCUDA sabit 100 kuruş (1 TL); client'tan asla okunmaz.
 *  - başarıda tam sayfa 3DS challenge HTML'i; hata/limit/token durumunda 303 ile
 *    /payment/result'a (vref = workshop'u tanıtan token; SONUÇ query'den DEĞİL DB'den).
 */

const RL_MAX = 10
const RL_WINDOW_MS = 10 * 60_000

const VERIFY_AMOUNT_MINOR = 100

function appOrigin(request: Request): string {
  return process.env.APP_URL || new URL(request.url).origin
}

function verifyRedirect(request: Request, vtoken: string | null, err?: string): Response {
  const url = new URL("/payment/result", appOrigin(request))
  if (vtoken) url.searchParams.set("vref", vtoken)
  if (err) url.searchParams.set("err", err)
  // 303: native form POST sonrası tarayıcı GET ile sonuç sayfasına gitsin.
  return NextResponse.redirect(url, 303)
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return verifyRedirect(request, null, "card")
  }
  const vtoken = typeof form.get("vtoken") === "string" ? (form.get("vtoken") as string) : null

  // 1) IP rate limit — satış initiate'iyle aynı desen/limit (paylaşılan kova).
  const limit = rateLimit(`payment:${ip}`, RL_MAX, RL_WINDOW_MS)
  if (!limit.allowed) {
    return verifyRedirect(request, vtoken, "rate")
  }

  // 2) Token → workshopId. Geçersiz/kurcalanmış/süresi geçmiş → vref YOK (sayfa genel hata).
  const workshopId = vtoken ? readVerifyToken(vtoken) : null
  if (!workshopId) {
    return verifyRedirect(request, null, "vtoken")
  }

  // 3) Workshop yükle. Yoksa → hata. Pending değilse (zaten doğrulanmış) → hiçbir şey
  //    yapma, taze token'la result'a dön (sayfa "zaten doğrulandı → giriş" gösterir).
  const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } })
  if (!workshop) {
    return verifyRedirect(request, null, "vtoken")
  }
  if (workshop.approvalStatus !== "pending") {
    return verifyRedirect(request, createVerifyToken(workshop.id))
  }

  // 4) Kart alanlarını server-side doğrula (satışla AYNI zod şeması).
  const parsed = cardSchema.safeParse({
    holderName: form.get("holderName"),
    number: form.get("number"),
    expireMonth: form.get("expireMonth"),
    expireYear: form.get("expireYear"),
    cvv: form.get("cvv"),
  })
  if (!parsed.success) {
    return verifyRedirect(request, vtoken, "card")
  }
  const card = parsed.data

  // 4b) Prod'da TAMI yapılandırması eksikse mock'a sessizce düşme — akışı kapat,
  //     founder'ı günlük dedup ile uyar (satış initiate ile aynı guard).
  if (isCardPaymentBlocked({ nodeEnv: process.env.NODE_ENV, tamiConfigured: isTamiConfigured() })) {
    console.error("[payments/verify/initiate] TAMI prod yapılandırması eksik — doğrulama kapalı")
    await alertTamiMisconfigOnce({ workshopId, reference: `verify:${workshopId}` }).catch((err) => {
      console.error("[payments/verify/initiate] misconfig alert error:", err instanceof Error ? err.message : err)
    })
    return verifyRedirect(request, vtoken, "config")
  }

  // 5) providerOrderId: VRF- + 12 hex (2-36 kar.); deneme başına benzersiz.
  const providerOrderId = generateProviderOrderId("VRF")
  const correlationId = crypto.randomUUID()

  // 6) PaymentTransaction — purpose card_verification, billingOrderId null, tutar SABİT 100.
  const txn = await prisma.paymentTransaction.create({
    data: {
      purpose: "card_verification",
      billingOrderId: null,
      workshopId,
      provider: "tami",
      providerOrderId,
      status: "initiated",
      amountMinor: VERIFY_AMOUNT_MINOR,
      currency: "TRY",
      correlationId,
    },
  })

  // 7) Buyer/adres: workshop kayıt bilgileri + owner kullanıcısı.
  const owner = await prisma.user.findFirst({
    where: { workshopId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { firstName: true, lastName: true, email: true },
  })
  const ownerName =
    owner?.firstName || owner?.lastName
      ? { name: owner.firstName || "-", surName: owner.lastName || owner.firstName || "-" }
      : splitName(workshop.name)
  const email = owner?.email || workshop.email || "musteri@bakimx.com"
  const phone = workshop.phone || ""
  const buyerIp = resolveClientIp(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip")
  )

  const body = buildTamiPaymentBody({
    orderId: providerOrderId,
    amountMinor: VERIFY_AMOUNT_MINOR,
    callbackUrl: `${appOrigin(request)}/api/payments/tami/callback`,
    card: {
      number: card.number,
      holderName: card.holderName,
      expireMonth: card.expireMonth,
      expireYear: card.expireYear,
      cvv: card.cvv,
    },
    contact: {
      name: ownerName.name,
      surName: ownerName.surName,
      email,
      phone,
      ip: buyerIp,
      city: workshop.city || undefined,
      address: workshop.address || undefined,
      companyName: workshop.name,
    },
    basketItemName: "Kart doğrulama",
  })

  try {
    const res = await getTamiClient().preAuth3ds(body)
    if (!res.threeDSHtmlContent) {
      throw new TamiError({ code: "NO_3DS_HTML", message: "TAMI 3DS HTML içeriği boş döndü" })
    }
    if (res.correlationId && res.correlationId !== correlationId) {
      await prisma.paymentTransaction
        .update({ where: { id: txn.id }, data: { correlationId: res.correlationId } })
        .catch(() => {})
    }
    const html = Buffer.from(res.threeDSHtmlContent, "base64").toString("utf8")
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (err) {
    const code = err instanceof TamiError ? err.code : "UNKNOWN"
    const message = err instanceof TamiError ? err.message : "TAMI 3DS başlatma hatası"
    // Kart verisi ASLA loglanmaz — yalnız kod/mesaj + txn kimliği.
    console.error("[payments/verify/initiate] preAuth3ds failed:", sanitizeForLog({ providerOrderId, code, message }))
    await prisma.paymentTransaction
      .update({ where: { id: txn.id }, data: { status: "failed", errorCode: code, errorMessage: message } })
      .catch(() => {})
    return verifyRedirect(request, createVerifyToken(workshopId))
  }
}
