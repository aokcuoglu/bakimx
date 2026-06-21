"use client"

import { useState } from "react"
import { Send, Loader2, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

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
        setShowConfirm(false)
      }
    } catch {
      setError("Hatırlatma gönderilemedi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)} className="text-primary border-primary/20 hover:bg-primary/5">
        <Send className="size-3.5 mr-1" />
        Hatırlatma Gönder
      </Button>

      {result && (
        <div className="rounded-lg border border-success/20 bg-success/10 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            <p className="text-sm font-medium text-success-foreground">Hatırlatma gönderildi</p>
          </div>
          <p className="text-xs text-success">
            {customerName}{vehiclePlate ? ` — ${vehiclePlate}` : ""} için tahsilat hatırlatması gönderildi.
          </p>
          <button
            onClick={() => { setResult(null) }}
            className="text-xs text-success hover:text-success-foreground font-medium"
          >
            Kapat
          </button>
        </div>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                Tahsilat Hatırlatması Gönder
              </span>
            </DialogTitle>
            <DialogDescription>
              {customerName} müşterisine{vehiclePlate ? ` (${vehiclePlate})` : ""} {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(remainingAmount)} tutarındaki alacak için hatırlatma gönderilecek.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Müşterinin iletişim izinlerine göre SMS, WhatsApp veya e-posta gönderilir.</p>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>Vazgeç</Button>
            <Button size="sm" onClick={handleSend} disabled={loading}>
              {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Send className="size-3.5 mr-1" />}
              Gönder
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5" />
              {error}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}