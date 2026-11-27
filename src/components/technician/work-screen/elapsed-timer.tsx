"use client"

import { useEffect, useState } from "react"
import { formatElapsed } from "@/lib/technician/elapsed"
import { formatTrTime } from "@/lib/format-date"

/**
 * Sürmekte olan işçiliğin canlı sayacı. Sunucuda yer tutucu ("–:––") basılır,
 * saniye vuruşu mount'tan SONRA başlar: sunucu ve istemci saati farklı olduğu
 * için ilk boyamada gerçek değer yazmak hidrasyon uyumsuzluğu üretirdi.
 * Akan metin ekran okuyucudan gizlidir (her saniye okunmasın); okuyucuya
 * sabit bir cümle verilir.
 */
export function ElapsedTimer({ startTime }: { startTime: string }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = now == null ? "–:––" : formatElapsed(now - new Date(startTime).getTime())

  return (
    <div className="flex items-center gap-2 text-success-strong">
      <span className="size-2 shrink-0 rounded-full bg-success motion-safe:animate-pulse" aria-hidden />
      <span className="text-2xl font-semibold tabular-nums" aria-hidden>
        {elapsed}
      </span>
      <span className="text-xs text-muted-foreground" aria-hidden>
        {formatTrTime(startTime)} başlangıç
      </span>
      <span className="sr-only">İşçilik sürüyor, başlangıç {formatTrTime(startTime)}</span>
    </div>
  )
}
