"use client"

import { ShieldCheck, Lock } from "lucide-react"
import { CardFormFields } from "@/components/billing/card-form-fields"
import { formatMinor } from "@/lib/billing/pricing"

/**
 * Kart ödeme paneli (SATIŞ). Ortak `CardFormFields` iskeletini satış öntanımlarıyla
 * sarar (action = satış initiate, gizli alan = reference). Kart verisi form gövdesi
 * dışında HİÇBİR yere gitmez; loglanmaz/saklanmaz — bkz. CardFormFields.
 */

const INITIATE_URL = "/api/payments/tami/initiate"

export function CardPaymentPanel({
  reference,
  amountMinor,
  planLabel,
  presentation = "default",
}: {
  reference: string
  amountMinor: number
  planLabel?: string
  presentation?: "default" | "attio"
}) {
  if (presentation === "attio") {
    return (
      <CardFormFields
        action={INITIATE_URL}
        hidden={{ reference }}
        presentation="attio"
        summary={
          <>
            <h3 className="text-sm font-semibold">Ödeme özeti</h3>
            <div className="space-y-2 border-b pb-3 text-xs">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Paket</span><span className="text-right font-medium">{planLabel}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Referans</span><span className="break-all text-right font-mono">{reference}</span></div>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-sm font-semibold"><span>Ödenecek</span><span>{formatMinor(amountMinor)}</span></div>
            <p className="text-xs leading-5 text-muted-foreground">Kart bilgileriniz saklanmaz. Onayınızdan sonra bankanızın 3D Secure ekranına geçersiniz.</p>
          </>
        }
        submitLabel={<><Lock className="size-4" /> {formatMinor(amountMinor)} öde</>}
        submittingLabel={<>3D Secure&apos;a yönlendiriliyorsunuz…</>}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold text-foreground">Kart ile ödeme</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          3D Secure ile güvenli ödeme. Onayladığınızda bankanızın doğrulama ekranına
          yönlendirilirsiniz.
        </p>
      </div>

      {/* Tutar + paket özeti */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
        <div className="min-w-0">
          {planLabel && <p className="font-semibold text-foreground">{planLabel}</p>}
          <p className="text-xs text-muted-foreground">
            Referans: <span className="font-mono">{reference}</span>
          </p>
        </div>
        <p className="ml-3 shrink-0 text-lg font-bold text-foreground">
          {formatMinor(amountMinor)}
        </p>
      </div>

      <CardFormFields
        action={INITIATE_URL}
        hidden={{ reference }}
        submitLabel={
          <>
            <Lock className="size-4" /> {formatMinor(amountMinor)} öde
          </>
        }
        submittingLabel={<>3D Secure&apos;a yönlendiriliyorsunuz…</>}
      />

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Kart bilgileriniz sunucularımızda saklanmaz; ödeme TAMI (Garanti BBVA)
          altyapısında 3D Secure ile alınır.
        </span>
      </p>
    </div>
  )
}
