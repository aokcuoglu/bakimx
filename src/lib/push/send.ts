import "server-only"
import webpush, { WebPushError } from "web-push"
import { prisma } from "@/lib/db"
import { getVapidConfig } from "@/lib/push/config"

/**
 * Web Push gönderimi (BAK-129, Faz B).
 *
 * Bu modül "kime gönderilir" sorusunu HİÇ yanıtlamaz — kiracı/alıcı seçimi
 * çağıranın işidir (bkz. src/lib/technician/push-dispatch.ts). Burada yalnız
 * teslimat ve ölü abonelik temizliği var.
 */

/** Bildirim gövdesi — `public/sw.js` bu şekli bekler. */
export type PushPayload = {
  title: string
  body?: string
  /** Tıklanınca açılacak uygulama-içi yol (ör. `/technician/orders/abc`). */
  url?: string
  /** Aynı `tag` ile gelen bildirim öncekinin ÜZERİNE yazar (yığılma olmaz). */
  tag?: string
}

export type PushTarget = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type PushSendResult = { sent: number; failed: number; removed: number }

/** Bir push servisinin yanıtı ne kadar beklenir. */
const SEND_TIMEOUT_MS = 5000
/** Bildirim bu süre içinde teslim edilemezse düşsün — bayat iş emri bildirimi gürültüdür. */
const TTL_SECONDS = 600

/**
 * Abonelik ARTIK YOK sinyali. 404: endpoint hiç yok, 410 (Gone): kullanıcı
 * bildirimleri kapattı / tarayıcı verisini sildi. Her ikisinde de satırı
 * silmezsek tablo ölü aboneliklerle şişer ve her olayda boşuna istek atarız.
 */
const DEAD_SUBSCRIPTION_STATUS = new Set([404, 410])

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("push_timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<PushSendResult> {
  const vapid = getVapidConfig()
  if (!vapid || targets.length === 0) return { sent: 0, failed: 0, removed: 0 }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
  const body = JSON.stringify(payload)

  const outcomes = await Promise.all(
    targets.map(async (target) => {
      try {
        await withTimeout(
          webpush.sendNotification(
            { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
            body,
            { TTL: TTL_SECONDS },
          ),
          SEND_TIMEOUT_MS,
        )
        return { ok: true, dead: false }
      } catch (error) {
        const dead = error instanceof WebPushError && DEAD_SUBSCRIPTION_STATUS.has(error.statusCode)
        return { ok: false, dead }
      }
    }),
  )

  const deadIds = targets.filter((_, index) => outcomes[index].dead).map((target) => target.id)
  if (deadIds.length > 0) {
    // Temizlik teslimatı bloklamaz: silme hatası bir sonraki gönderimde tekrar denenir.
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } }).catch(() => undefined)
  }

  return {
    sent: outcomes.filter((outcome) => outcome.ok).length,
    failed: outcomes.filter((outcome) => !outcome.ok).length,
    removed: deadIds.length,
  }
}
