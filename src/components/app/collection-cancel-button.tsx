"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

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
        alert(data.error || "Tahsilat iptal edilemedi")
      }
    } catch {
      alert("Bir hata oluştu")
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  if (!showConfirm) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)} className="text-rose-600 border-rose-200 hover:bg-rose-50">
        <XCircle className="size-3.5 mr-1" />
        İptal Et
      </Button>
    )
  }

  return (
    <div className="space-y-3 p-4 rounded-xl border border-rose-200 bg-rose-50/50">
      <p className="text-sm font-semibold text-rose-800">Tahsilat İptali</p>
      <p className="text-xs text-rose-600">İptal nedenini yazınız. Bu işlem geri alınamaz.</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="İptal nedeni (zorunlu)…"
        rows={2}
        className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
      />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => { setShowConfirm(false); setReason("") }}>Vazgeç</Button>
        <Button variant="destructive" size="sm" onClick={handleCancel} disabled={loading || !reason.trim()}>
          {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <XCircle className="size-3.5 mr-1" />}
          İptal Et
        </Button>
      </div>
    </div>
  )
}