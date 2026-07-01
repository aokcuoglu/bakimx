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
 * /billing üzerinde bu diyalogla bilgilendirir.
 */
export function PendingOrderAlert({ reference }: { reference: string }) {
  const router = useRouter()

  function dismiss() {
    router.replace("/billing")
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && dismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bekleyen bir talebiniz var</AlertDialogTitle>
          <AlertDialogDescription>
            Havale açıklamasına <span className="font-semibold text-foreground">{reference}</span> yazıp ödemenizi
            yaptıysanız, teyit edilince paketiniz aktifleşecek. Onay beklerken yeni bir talep oluşturamazsınız.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={dismiss}>Anladım</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
