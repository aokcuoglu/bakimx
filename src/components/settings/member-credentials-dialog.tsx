"use client"

import { useState } from "react"
import { Check, Copy, MessageCircle, Printer, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  buildCredentialsWhatsAppText,
  renderCredentialsCardHtml,
  type MemberCredentials,
} from "@/lib/credential-card"

export type IssuedCredentials = {
  fullName: string
  username: string
  tempPassword: string
}

/**
 * Prod'da giriş ekranı landing host'unda durur (`app.bakimx.com` değil) — kart
 * ve WhatsApp metni yanlış adrese göndermesin. Yalnız tarayıcıda çağrılır.
 */
function resolveLoginUrl(): string {
  const host = window.location.hostname
  if (host === "app.bakimx.com") return "https://bakimx.com/login"
  return `${window.location.origin}/login`
}

/**
 * Kartı AYRI bir belgede yazdırır: gizli bir iframe'e basıp onu yazdırıyoruz,
 * böylece kâğıda yalnız bu kişinin bilgisi çıkar — ekip listesi, menü ve diğer
 * kullanıcılar değil. `afterprint` gelmezse iframe zamanlayıcıyla toplanır.
 */
function printCredentialsCard(card: MemberCredentials) {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.setAttribute("title", "Giriş bilgileri kartı")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
  frame.srcdoc = renderCredentialsCardHtml(card)

  const cleanup = () => frame.remove()
  frame.addEventListener("load", () => {
    const win = frame.contentWindow
    if (!win) return cleanup()
    win.addEventListener("afterprint", cleanup)
    win.focus()
    win.print()
    // Bazı tarayıcılar `afterprint` yaymaz; iframe sayfada asılı kalmasın.
    setTimeout(cleanup, 60_000)
  })
  document.body.appendChild(frame)
}

/**
 * Yeni açılan (ya da şifresi sıfırlanan) e-postasız kullanıcının giriş
 * bilgilerini bir kez gösteren pencere (BAK-37).
 *
 * Geçici şifre YALNIZ burada görünür: kapatıldıktan sonra bir daha
 * görüntülenemez, çünkü sunucuda yalnızca bcrypt özeti duruyor. Bu yüzden pencere
 * kapanmadan önce üç çıkış yolu sunar — kopyala, WhatsApp, yazdır.
 */
export function MemberCredentialsDialog({
  credentials,
  workshopName,
  loginCode,
  onClose,
}: {
  credentials: IssuedCredentials | null
  workshopName: string
  loginCode: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const open = credentials !== null
  const card = (): MemberCredentials => ({
    workshopName,
    loginCode,
    loginUrl: resolveLoginUrl(),
    fullName: credentials!.fullName,
    username: credentials!.username,
    tempPassword: credentials!.tempPassword,
  })

  function handleCopy() {
    navigator.clipboard?.writeText(buildCredentialsWhatsAppText(card()))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(buildCredentialsWhatsAppText(card()))
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
  }

  const rows = credentials
    ? [
        { label: "İş yeri kodu", value: loginCode },
        { label: "Kullanıcı adı", value: credentials.username },
        { label: "Geçici şifre", value: credentials.tempPassword },
      ]
    : []

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Giriş bilgileri hazır</DialogTitle>
          <DialogDescription>
            {credentials?.fullName} artık kullanıcı adı ve geçici şifreyle giriş yapabilir. İlk
            girişte kendi şifresini belirlemesi istenecek.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 flex items-start gap-2">
          <TriangleAlert className="size-4 text-warning-strong shrink-0 mt-0.5" />
          <p className="text-xs text-warning-strong leading-relaxed">
            Geçici şifre yalnız bu ekranda görünür. Pencereyi kapattıktan sonra bir daha
            görüntülenemez — kaybolursa yeni bir şifre üretmeniz gerekir.
          </p>
        </div>

        <dl className="rounded-lg border border-border divide-y divide-border">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground shrink-0">{row.label}</dt>
              <dd className="text-sm font-semibold font-mono text-foreground break-all text-right">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Mobil öncelikli: dar ekranda tek sütun, sm'den itibaren yan yana. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button type="button" variant="outline" onClick={handleCopy} className="touch-manipulation">
            {copied ? <Check className="size-4 text-success-strong" /> : <Copy className="size-4" />}
            {copied ? "Kopyalandı" : "Kopyala"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleWhatsApp}
            className="touch-manipulation"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => printCredentialsCard(card())}
            className="touch-manipulation"
          >
            <Printer className="size-4" />
            Yazdır
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" size="lg" onClick={onClose} className="w-full touch-manipulation">
            Bilgileri ilettim, kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
