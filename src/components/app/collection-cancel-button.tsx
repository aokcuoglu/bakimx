"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function CancelCollectionButton({ collectionId }: { collectionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [reason, setReason] = useState("")

  async function handleCancel() {
    if (!reason.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/cashbox/collections/${collectionId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        toast.error(data.error || "Tahsilat iptal edilemedi")
      }
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)} className="text-destructive border-destructive/20 hover:bg-destructive/10">
        <XCircle className="size-3.5 mr-1" />
        İptal Et
      </Button>
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tahsilat İptali</DialogTitle>
            <DialogDescription>İptal nedenini yazınız. Bu işlem geri alınamaz.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="İptal nedeni (zorunlu)…"
            rows={2}
            className="border-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/30"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowConfirm(false); setReason("") }}>Vazgeç</Button>
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={loading || !reason.trim()}>
              {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <XCircle className="size-3.5 mr-1" />}
              İptal Et
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}