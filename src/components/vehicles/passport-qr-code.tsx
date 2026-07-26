"use client"

import { useSyncExternalStore } from "react"
import { QRCodeSVG } from "qrcode.react"

// The mounted flag never changes after the first client render, so subscribe is a no-op.
const subscribe = () => () => {}

export function PassportQRCode({ url, size = 128 }: { url: string; size?: number }) {
  // The url depends on window.location.origin, which is absent during SSR, so the
  // server- and client-rendered QR encode different strings (a hydration mismatch).
  // Read a client-only flag via useSyncExternalStore (server snapshot = false,
  // client = true) so the QR renders only after hydration — no mismatch and no
  // setState-in-effect. The white box reserves the layout space meanwhile.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className="bg-white p-3 rounded-lg border border-border"
        style={{ width: size + 24, height: size + 24 }}
      >
        {mounted ? (
          <QRCodeSVG
            value={url}
            size={size}
            level="M"
            includeMargin={false}
            bgColor="#FFFFFF"
            fgColor="#0B1F3A"
          />
        ) : null}
      </div>
    </div>
  )
}
