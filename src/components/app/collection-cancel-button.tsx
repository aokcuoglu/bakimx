"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CancelCollectionButton({ collectionId }: { collectionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/cashbox/collections/${collectionId}/cancel`, { method: "POST" })
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
    <div className="flex items-center gap-2">
      <p className="text-sm text-rose-700 font-medium">Emin misiniz?</p>
      <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>Vazgeç</Button>
      <Button variant="destructive" size="sm" onClick={handleCancel} disabled={loading}>
        {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <XCircle className="size-3.5 mr-1" />}
        İptal Et
      </Button>
    </div>
  )
}