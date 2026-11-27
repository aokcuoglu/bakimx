import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatMinor } from "@/lib/billing/pricing"
import type { HavaleInfo } from "@/lib/billing/provider"

/** Havale/EFT talebi oluşturuldu ekranı: tutar, hesap bilgisi ve referans kodu. */
export function HavaleInstructions({
  havale,
  reference,
  amountMinor,
  subtitle,
  onClose,
}: {
  havale: HavaleInfo
  reference: string
  amountMinor: number
  subtitle: string
  onClose: () => void
}) {
  return (
    <div className="mx-auto max-w-lg space-y-5 py-3" role="status">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-7 text-success-strong" aria-hidden="true" />
        <div><h3 className="text-lg font-semibold">Havale talebiniz oluşturuldu</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-md border bg-muted/30 p-4 text-sm">
        <dt className="text-muted-foreground">Tutar</dt><dd className="font-semibold">{formatMinor(amountMinor)}</dd>
        <dt className="text-muted-foreground">Alıcı</dt><dd>{havale.accountTitle}</dd>
        <dt className="text-muted-foreground">Banka</dt><dd>{havale.bank}</dd>
        <dt className="text-muted-foreground">IBAN</dt><dd className="break-all font-mono">{havale.iban}</dd>
        <dt className="text-muted-foreground">Açıklama</dt><dd className="font-mono font-semibold">{reference}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">Havale açıklamasına referans kodunu yazın.</p>
      <Button type="button" variant="outline" onClick={onClose}>Sayfaya dön</Button>
    </div>
  )
}
