"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cancelPendingBillingOrder } from "@/app/(app)/billing/actions"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function CancelPendingOrderButton({ reference }: { reference: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function cancel() {
    setBusy(true)
    try {
      const result = await cancelPendingBillingOrder(reference)
      if (result.ok) {
        toast.success("Bekleyen talep iptal edildi. Yeni bir paket seçebilirsiniz.")
        setOpen(false)
        router.refresh()
      } else toast.error(result.error)
    } catch {
      toast.error("Talep iptal edilemedi. Lütfen tekrar deneyin.")
    } finally {
      setBusy(false)
    }
  }

  return <>
    <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>Talebi iptal et</Button>
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bekleyen ödeme iptal edilsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Yalnız bu bekleyen sipariş iptal edilir. Etkin paketiniz ve erişiminiz devam eder. Ardından başka bir paket seçebilirsiniz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void cancel() }}>Talebi iptal et</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
