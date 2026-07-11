"use client"

import { useEffect } from "react"
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-error"

/**
 * Kök (global) hata sınırı. Kök layout dahil TÜM rotaları kapsar — (auth), admin,
 * public token sayfaları gibi (app) segmenti dışındaki her yeri. Bu dosya kök
 * layout'un yerine render edildiği için global CSS yüklenmez → inline stil.
 *
 * Asıl amaç: deploy sonrası bayat chunk hatasını yakalayıp sayfayı bir kez
 * yenilemek; böylece kullanıcı cache/history temizlemeden düzelir.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Bayat chunk ise sessizce yenile (UI hiç görünmeden çıkar).
    if (isChunkLoadError(error) && reloadOnceForChunkError()) return
    console.error("[global error boundary]", error)
  }, [error])

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "0 24px",
          textAlign: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          Bir şeyler ters gitti
        </h1>
        <p style={{ maxWidth: 360, fontSize: 14, color: "#64748b", margin: 0 }}>
          İşlem tamamlanamadı. Lütfen sayfayı yenileyin.
        </p>
        <button
          onClick={() => {
            // Yeni sürüm yüklenmiş olabilir; reset yerine tam yenileme daha güvenli.
            if (typeof window !== "undefined") window.location.reload()
            else reset()
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            borderRadius: 8,
            background: "#1e3a8a",
            color: "#fff",
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Sayfayı yenile
        </button>
      </body>
    </html>
  )
}
