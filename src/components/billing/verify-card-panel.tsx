"use client"

import { ShieldCheck } from "lucide-react"
import { CardFormFields } from "@/components/billing/card-form-fields"

/**
 * Kayıtta kart doğrulama paneli. Ortak `CardFormFields` iskeletini doğrulama
 * öntanımlarıyla sarar: action = verify initiate, gizli alan = imzalı `vtoken`.
 * Karttan 1 TL'lik ön provizyon alınır ve anında iade edilir; kart verisi form
 * gövdesi dışında HİÇBİR yere gitmez (bkz. CardFormFields).
 */

const VERIFY_INITIATE_URL = "/api/payments/tami/verify/initiate"

export function VerifyCardPanel({ vtoken }: { vtoken: string }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold text-foreground">Kartınızı doğrulayın</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          3D Secure ile kartınızı doğrulayın. Onayladığınızda bankanızın doğrulama
          ekranına yönlendirilirsiniz.
        </p>
      </div>

      <CardFormFields
        action={VERIFY_INITIATE_URL}
        hidden={{ vtoken }}
        submitLabel={
          <>
            <ShieldCheck className="size-4" /> Kartı Doğrula (1 TL provizyon)
          </>
        }
        submittingLabel={<>3D Secure&apos;a yönlendiriliyorsunuz…</>}
      />

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Kartınızdan 1 TL&apos;lik doğrulama provizyonu alınır ve anında iade edilir.
          Kart bilgileriniz saklanmaz.
        </span>
      </p>
    </div>
  )
}
