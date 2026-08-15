"use client"

import { useState } from "react"
import { useSyncExternalStore } from "react"
import { Copy, Check, MessageCircle, Printer, QrCode } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import {
  buildEntryWhatsAppText,
  renderEntryCardHtml,
  type WorkshopEntryCard,
} from "@/lib/workshop-entry-card"

function resolveEntryUrl(loginCode: string): string {
  const host = window.location.hostname
  if (host === "app.bakimx.com") return `https://bakimx.com/w/${loginCode}`
  return `${window.location.origin}/w/${loginCode}`
}

function printEntryCard(card: WorkshopEntryCard) {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.setAttribute("title", "Giriş kartı")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
  frame.srcdoc = renderEntryCardHtml(card)

  const cleanup = () => frame.remove()
  frame.addEventListener("load", () => {
    const win = frame.contentWindow
    if (!win) return cleanup()
    win.addEventListener("afterprint", cleanup)
    win.focus()
    win.print()
    setTimeout(cleanup, 60_000)
  })
  document.body.appendChild(frame)
}

const subscribe = () => () => {}

export function WorkshopEntryQR({
  workshopName,
  loginCode,
  logoUrl,
}: {
  workshopName: string
  loginCode: string
  logoUrl?: string
}) {
  const [copied, setCopied] = useState(false)

  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

  const entryUrl = mounted ? resolveEntryUrl(loginCode) : ""
  const card: WorkshopEntryCard = {
    workshopName,
    loginCode,
    entryUrl,
    logoUrl,
  }

  function handleCopy() {
    navigator.clipboard?.writeText(entryUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(buildEntryWhatsAppText(card))
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="size-5 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">Giriş Bağlantısı</h3>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Personellerinizin atölye giriş bağlantısı. QR kodu tarayarak ya da iş yeri kodunu girerek giriş yapabilirler.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-muted-foreground">QR Kod</p>
          <div className="inline-flex flex-col items-center gap-2">
            <div className="bg-white p-3 rounded-lg border border-border">
              {mounted && entryUrl ? (
                <QRCodeSVG
                  value={entryUrl}
                  size={160}
                  level="M"
                  includeMargin={false}
                  bgColor="#FFFFFF"
                  fgColor="#0B1F3A"
                />
              ) : (
                <div className="w-[160px] h-[160px] bg-muted" />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground">Bağlantı Bilgisi</p>
          <div className="rounded-lg border border-border divide-y divide-border">
            <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">İş Yeri Kodu</dt>
              <dd className="text-sm font-semibold font-mono text-foreground">{loginCode}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Bağlantı</dt>
              <dd className="text-xs font-mono text-foreground break-all text-right">{entryUrl}</dd>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Personel QR kodu tarayarak ya da iş yeri kodunu girerek atölyenin giriş ekranından personel girişi yapabilir.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button type="button" variant="outline" onClick={handleCopy} className="touch-manipulation">
          {copied ? <Check className="size-4 text-success-strong" /> : <Copy className="size-4" />}
          {copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}
        </Button>
        <Button type="button" variant="outline" onClick={handleWhatsApp} className="touch-manipulation">
          <MessageCircle className="size-4" />
          WhatsApp ile Paylaş
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => printEntryCard(card)}
          className="touch-manipulation"
        >
          <Printer className="size-4" />
          Kartı Yazdır
        </Button>
      </div>
    </div>
  )
}
