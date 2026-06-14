"use client"

import { useState } from "react"
import { Send, Loader2, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

type ReminderResult = {
  sms?: { success: boolean; error?: string }
  whatsapp?: { success: boolean; error?: string }
  email?: { success: boolean; error?: string }
}

export function SendReminderButton({
  customerId,
  serviceOrderId,
  customerName,
  vehiclePlate,
  remainingAmount,
}: {
  customerId: string
  serviceOrderId?: string
  customerName: string
  vehiclePlate?: string | null
  remainingAmount: number
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReminderResult | null>(null)
  const [error, setError] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSend() {
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch("/api/cashbox/collections/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, serviceOrderId }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data.result || {})
      }
    } catch {
      setError("Hatırlatma gönderilemedi")
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800">Hatırlatma gönderildi</p>
        </div>
        <p className="text-xs text-emerald-600">
          {customerName}{vehiclePlate ? ` — ${vehiclePlate}` : ""} için tahsilat hatırlatması gönderildi.
        </p>
        <button
          onClick={() => { setResult(null); setShowConfirm(false) }}
          className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
        >
          Kapat
        </button>
      </div>
    )
  }

  if (showConfirm) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <MessageSquare className="size-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Tahsilat Hatırlatması Gönder</p>
            <p className="text-xs text-blue-700 mt-0.5">
              {customerName} müşterisine{vehiclePlate ? ` (${vehiclePlate})` : ""} {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(remainingAmount)} tutarındaki alacak için hatırlatma gönderilecek.
            </p>
            <p className="text-xs text-blue-600 mt-1">Müşterinin iletişim izinlerine göre SMS, WhatsApp veya e-posta gönderilir.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>Vazgeç</Button>
          <Button size="sm" onClick={handleSend} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Send className="size-3.5 mr-1" />}
            Gönder
          </Button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600">
            <AlertCircle className="size-3.5" />
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
      <Send className="size-3.5 mr-1" />
      Hatırlatma Gönder
    </Button>
  )
}