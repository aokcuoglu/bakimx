"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { BellOff, BellRing, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * "Bildirimleri aç" kapısı — BAK-129, Faz B (Web Push).
 *
 * Faz A (uygulama-içi yoklama) yalnız panel AÇIKKEN çalışır. Bu bileşen aynı
 * bildirimleri panel kapalıyken de ulaştıran Web Push aboneliğini yönetir:
 * izin iste → service worker'ı kaydet → aboneliği sunucuya yaz.
 *
 * iOS kısıtı bilinçli olarak GÖRÜNÜR: Safari'de Web Push yalnız "Ana Ekrana
 * Ekle" ile kurulmuş PWA'da (iOS 16.4+) çalışır. Tarayıcı sekmesinde
 * `PushManager` hiç tanımlı değildir; kullanıcıya "desteklenmiyor" demek
 * yerine ne yapması gerektiği yazılır.
 */

type PushState = "loading" | "unsupported" | "ios-needs-install" | "not-configured" | "denied" | "off" | "on"

function isIOS(): boolean {
  // iPadOS 13+ kendini macOS olarak tanıtır; dokunmatik nokta sayısı ayırır.
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
}

function isStandalonePWA(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone
  return iosStandalone === true || window.matchMedia("(display-mode: standalone)").matches
}

/**
 * VAPID açık anahtarı base64url metin olarak gelir; `applicationServerKey` bayt
 * ister. Dönüş tipi `Uint8Array<ArrayBuffer>`: TS 5.7+ `Uint8Array`i buffer
 * türüyle birlikte tipliyor ve varsayılan `ArrayBufferLike`, `BufferSource`a
 * atanamıyor — buffer'ı açıkça `ArrayBuffer` olarak kurmak bunu çözer.
 */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function TechnicianPushToggle() {
  const [state, setState] = useState<PushState>("loading")
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const detect = async () => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      if (!supported) {
        if (!cancelled) setState(isIOS() && !isStandalonePWA() ? "ios-needs-install" : "unsupported")
        return
      }

      try {
        const res = await fetch("/api/technician/push", { cache: "no-store" })
        const data = (await res.json()) as { configured?: boolean; publicKey?: string | null }
        if (cancelled) return
        if (!res.ok || !data.configured || !data.publicKey) {
          setState("not-configured")
          return
        }
        setPublicKey(data.publicKey)

        if (Notification.permission === "denied") {
          setState("denied")
          return
        }
        const registration = await navigator.serviceWorker.getRegistration()
        const existing = await registration?.pushManager.getSubscription()
        if (cancelled) return
        setState(existing ? "on" : "off")
      } catch {
        if (!cancelled) setState("not-configured")
      }
    }

    void detect()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async () => {
    if (!publicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off")
        return
      }

      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }))

      const json = subscription.toJSON()
      const res = await fetch("/api/technician/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error("subscribe_failed")

      setState("on")
      toast.success("Bildirimler açıldı")
    } catch {
      toast.error("Bildirimler açılamadı. Lütfen tekrar deneyin.")
    } finally {
      setBusy(false)
    }
  }, [publicKey])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch("/api/technician/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setState("off")
      toast.success("Bildirimler kapatıldı")
    } catch {
      toast.error("Bildirimler kapatılamadı. Lütfen tekrar deneyin.")
    } finally {
      setBusy(false)
    }
  }, [])

  if (state === "loading" || state === "unsupported" || state === "not-configured") return null

  if (state === "ios-needs-install") {
    return (
      <p className="border-t px-1 pt-2 text-xs text-muted-foreground">
        iPhone/iPad&apos;de bildirim almak için bu sayfayı Paylaş → <strong>Ana Ekrana Ekle</strong> ile
        kurun, sonra ana ekrandaki BakımX simgesinden açın. Safari sekmesinde bildirim gönderilemiyor.
      </p>
    )
  }

  if (state === "denied") {
    return (
      <p className="border-t px-1 pt-2 text-xs text-muted-foreground">
        Bildirim izni bu cihazda reddedilmiş. Tarayıcı ayarlarından BakımX için bildirimlere izin
        verdikten sonra tekrar deneyin.
      </p>
    )
  }

  return (
    <div className="border-t pt-2">
      <Button
        type="button"
        variant="ghost"
        onClick={() => void (state === "on" ? disable() : enable())}
        disabled={busy}
        className="w-full justify-start gap-2"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state === "on" ? (
          <BellOff className="size-4" />
        ) : (
          <BellRing className="size-4" />
        )}
        <span className="text-sm">{state === "on" ? "Bildirimleri kapat" : "Bildirimleri aç"}</span>
      </Button>
      <p className="px-1 pb-1 text-xs text-muted-foreground">
        {state === "on"
          ? "Uygulama kapalıyken de atama ve durum değişikliklerini bu cihaza bildiririz."
          : "Panel kapalıyken de haberdar olmak için bu cihazda bildirimleri açın."}
      </p>
    </div>
  )
}
