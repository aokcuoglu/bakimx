import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { prisma } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { getCurrentUser } from "@/lib/auth"
import { getTamiClient } from "@/lib/tami"
import { getTamiConfig, isTamiConfigured } from "@/lib/tami/config"
import { alertTamiMisconfigOnce } from "@/lib/tami/misconfig-alert"
import { TamiError, sanitizeForLog } from "@/lib/tami/errors"
import type { TamiAuth3dsInput } from "@/lib/tami/types"
import {
  minorToTamiAmount,
  generateProviderOrderId,
  resolveClientIp,
  splitName,
  luhnCheck,
} from "@/lib/billing/payment-helpers"

/**
 * TAMI 3DS başlatma. Native HTML form POST (application/x-www-form-urlencoded)
 * alır: `reference` + kart alanları. Kart verisi YALNIZ bellekte tutulur; hiçbir
 * log/DB/hata nesnesine düz metin olarak girmez (log'lar sanitizeForLog'tan geçer).
 * Başarıda tam sayfa 3DS challenge HTML'i döner; hata/limit durumunda 303 ile
 * /payment/result'a yönlendirir — ödeme SONUCU asla query'den okunmaz (yalnız
 * form-validation ipucu `err` taşınır), DB'den okunur.
 */

const RL_MAX = 10
const RL_WINDOW_MS = 10 * 60_000

const NOW = () => new Date()

const cardSchema = z
  .object({
    holderName: z.string().trim().min(2).max(64),
    number: z
      .string()
      .transform((s) => s.replace(/\s/g, ""))
      .refine((s) => /^\d{12,19}$/.test(s), "Kart numarası geçersiz")
      .refine((s) => luhnCheck(s), "Kart numarası geçersiz"),
    expireMonth: z.coerce.number().int().min(1).max(12),
    expireYear: z.coerce.number().int(),
    cvv: z.string().refine((s) => /^\d{3,4}$/.test(s), "CVV geçersiz"),
  })
  .transform((c) => ({
    ...c,
    // 2 haneli yılı 4 haneye normalize et ("28" → 2028).
    expireYear: c.expireYear < 100 ? c.expireYear + 2000 : c.expireYear,
  }))
  .refine(
    (c) => {
      const now = NOW()
      const y = now.getFullYear()
      const m = now.getMonth() + 1
      return c.expireYear > y || (c.expireYear === y && c.expireMonth >= m)
    },
    { message: "Kartın son kullanma tarihi geçmiş" }
  )

function appOrigin(request: Request): string {
  return process.env.APP_URL || new URL(request.url).origin
}

function resultRedirect(request: Request, ref: string | null, err?: string): Response {
  const url = new URL("/payment/result", appOrigin(request))
  if (ref) url.searchParams.set("ref", ref)
  if (err) url.searchParams.set("err", err)
  // 303: native form POST'un ardından tarayıcı GET ile sonuç sayfasına gitsin.
  return NextResponse.redirect(url, 303)
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)

  // Form gövdesini oku (kart alanları buradan çıkar; asla loglanmaz).
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return resultRedirect(request, null, "card")
  }
  const reference = typeof form.get("reference") === "string" ? (form.get("reference") as string) : null

  // 1) IP rate limit.
  const limit = rateLimit(`payment:${ip}`, RL_MAX, RL_WINDOW_MS)
  if (!limit.allowed) {
    return resultRedirect(request, reference, "rate")
  }

  // 2) Kart alanlarını server-side doğrula (zod + Luhn + son kullanma).
  const parsed = cardSchema.safeParse({
    holderName: form.get("holderName"),
    number: form.get("number"),
    expireMonth: form.get("expireMonth"),
    expireYear: form.get("expireYear"),
    cvv: form.get("cvv"),
  })
  if (!reference || !parsed.success) {
    return resultRedirect(request, reference, "card")
  }
  const card = parsed.data

  // 3) Siparişi yükle — kart yöntemli ve ödeme bekleyen olmalı.
  const order = await prisma.billingOrder.findUnique({ where: { reference } })
  if (!order || order.status !== "pending_payment" || order.method !== "card") {
    return resultRedirect(request, reference)
  }

  // 4) Oturum varsa tenant eşleşmesini doğrula; yoksa public akış (reference yeterli).
  const user = await getCurrentUser().catch(() => null)
  if (user && user.workshopId !== order.workshopId) {
    return resultRedirect(request, reference)
  }

  // 4b) Production'da TAMI kimlik bilgileri eksikse mock istemciye SESSİZCE düşme:
  // hiçbir txn oluşturma/işaretleme, kullanıcıya genel hata (err=config), founder'ı
  // günlük dedup ile uyar. Aksi halde sahte bir mock callback bedava aktivasyon
  // yapabilir (mock secret repoda public). Bu ekip iki kez prod env'i unuttu.
  if (getTamiConfig().env === "production" && !isTamiConfigured()) {
    console.error("[payments/initiate] TAMI prod yapılandırması eksik — kart akışı kapalı")
    await alertTamiMisconfigOnce({ workshopId: order.workshopId, reference }).catch((err) => {
      console.error("[payments/initiate] misconfig alert error:", err instanceof Error ? err.message : err)
    })
    return resultRedirect(request, reference, "config")
  }

  // Buyer/adres bilgisi: workshop + billingSnapshot + owner kullanıcısı.
  const [workshop, owner] = await Promise.all([
    prisma.workshop.findUnique({ where: { id: order.workshopId } }),
    prisma.user.findFirst({
      where: { workshopId: order.workshopId, role: "owner" },
      select: { firstName: true, lastName: true, email: true },
    }),
  ])
  if (!workshop) {
    return resultRedirect(request, reference)
  }

  const snapshot = (order.billingSnapshot ?? {}) as Record<string, unknown>
  const snap = (k: string): string => (typeof snapshot[k] === "string" ? (snapshot[k] as string) : "")
  const ownerName =
    owner?.firstName || owner?.lastName
      ? { name: owner.firstName || "-", surName: owner.lastName || owner.firstName || "-" }
      : splitName(snap("name") || workshop.name)
  const email = owner?.email || snap("email") || workshop.email || "musteri@bakimx.com"
  const phone = snap("phone") || workshop.phone || ""
  const buyerIp = resolveClientIp(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip")
  )

  // 5) PaymentTransaction (initiated) — amountMinor SNAPSHOT'ı order'dan alınır (client'tan asla).
  const providerOrderId = generateProviderOrderId(order.reference)
  const correlationId = crypto.randomUUID()
  const txn = await prisma.paymentTransaction.create({
    data: {
      billingOrderId: order.id,
      workshopId: order.workshopId,
      provider: "tami",
      providerOrderId,
      status: "initiated",
      amountMinor: order.amountMinor,
      currency: order.currency,
      correlationId,
    },
  })

  // 6) TAMI 3DS auth çağrısı — tutar order.amountMinor'dan türetilir.
  const auth: TamiAuth3dsInput = {
    orderId: providerOrderId,
    amount: minorToTamiAmount(order.amountMinor),
    // Sipariş para biriminden (DB default "TRY"); TamiAuth3dsInput tipi şimdilik
    // yalnız "TRY" literal'ını tanıdığı için daraltma cast'i gerekiyor.
    currency: order.currency as TamiAuth3dsInput["currency"],
    installmentCount: 1,
    callbackUrl: `${appOrigin(request)}/api/payments/tami/callback`,
    card: {
      number: card.number,
      holderName: card.holderName,
      expireMonth: card.expireMonth,
      expireYear: card.expireYear,
      cvv: card.cvv,
    },
    buyer: {
      buyerId: order.workshopId,
      name: ownerName.name,
      surName: ownerName.surName,
      ipAddress: buyerIp,
      emailAddress: email,
      phoneNumber: phone,
    },
    billingAddress: {
      address: snap("address") || workshop.address || "-",
      city: workshop.city || "-",
      country: "Türkiye",
      contactName: `${ownerName.name} ${ownerName.surName}`.trim(),
      companyName: snap("invoiceTitle") || workshop.name,
    },
  }

  try {
    const res = await getTamiClient().auth3ds(auth)
    if (!res.threeDSHtmlContent) {
      throw new TamiError({ code: "NO_3DS_HTML", message: "TAMI 3DS HTML içeriği boş döndü" })
    }
    // correlationId'i banka yanıtıyla güncelle (log/izleme için).
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
    console.error("[payments/initiate] auth3ds failed:", sanitizeForLog({ providerOrderId, code, message }))
    await prisma.paymentTransaction
      .update({
        where: { id: txn.id },
        data: { status: "failed", errorCode: code, errorMessage: message },
      })
      .catch(() => {})
    return resultRedirect(request, reference)
  }
}
