"use client"

import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

/**
 * /checkout, zaten bekleyen bir siparişi olan bir workshop'a düşünce buraya
 * yönlendirir — kullanıcıyı ayrı, bağlamsız bir sayfada bırakmak yerine
 * /billing üzerinde bu diyalogla bilgilendirir. Kart siparişlerinde havale
 * talimatı yerine "Ödemeye devam et" ile kart kurtarma sayfasına yönlendirir.
 */
export function PendingOrderAlert({ reference, method }: { reference: string; method?: string | null }) {
  const router = useRouter()
  const isCard = method === "card"

  function dismiss() {
    router.replace("/billing")
  }

  function continuePayment() {
    router.push(`/payment/result?ref=${encodeURIComponent(reference)}`)
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && dismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isCard ? "Kart ödemenizi tamamlayın" : "Bekleyen bir talebiniz var"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isCard ? (
              <>
                Başlattığınız kart ödemesi henüz tamamlanmadı. Ödemenizi tamamlamak için aşağıdan devam
                edin. Yeni bir talep oluşturabilmek için önce bu ödemeyi tamamlayın veya iptal ekibimizle
                iletişime geçin.
              </>
            ) : (
              <>
                Havale açıklamasına <span className="font-semibold text-foreground">{reference}</span> yazıp
                ödemenizi yaptıysanız, teyit edilince paketiniz aktifleşecek. Onay beklerken yeni bir talep
                oluşturamazsınız.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isCard && <AlertDialogAction onClick={continuePayment}>Ödemeye devam et</AlertDialogAction>}
          <AlertDialogAction variant={isCard ? "outline" : "default"} onClick={dismiss}>
            Anladım
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
