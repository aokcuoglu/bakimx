"use client"

import { QRCodeSVG } from "qrcode.react"

export function PassportQRCode({ url, size = 128 }: { url: string; size?: number }) {
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div className="bg-white p-3 rounded-lg border border-border">
        <QRCodeSVG
          value={url}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#FFFFFF"
          fgColor="#0B1F3A"
        />
      </div>
    </div>
  )
}