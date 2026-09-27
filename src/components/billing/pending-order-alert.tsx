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
 * /settings/billing üzerinde bu diyalogla bilgilendirir. Kart ödeme formu
 * sayfadaki bekleyen ödeme şeridinden açılır.
 */
export function PendingOrderAlert({ reference, method }: { reference: string; method?: string | null }) {
  const router = useRouter()
  const isCard = method === "card"

  function dismiss() {
    router.replace("/settings/billing")
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
                Başlattığınız kart ödemesi henüz tamamlanmadı. Faturalandırma sayfasındaki bekleyen ödeme
                alanından devam edin. Farklı paket seçmek için bekleyen kart talebinizi aynı sayfadan iptal edin.
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
          <AlertDialogAction onClick={dismiss}>Faturalandırmaya dön</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
