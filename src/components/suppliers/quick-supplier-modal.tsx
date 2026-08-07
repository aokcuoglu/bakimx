"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus } from "lucide-react"

/**
 * Parça formundan ayrılmadan tedarikçi carisi açar. Yalnız zorunlu alanı (ad)
 * ister; kalan cari bilgileri /suppliers ekranından tamamlanır.
 */
export function QuickSupplierModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  onCreated: (supplier: { id: string; name: string; phone: string | null }) => void
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function reset() {
    setName("")
    setPhone("")
    setCity("")
    setError(null)
  }

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Tedarikçi adı zorunludur")
      return
    }
    setPending(true)
    setError(null)
    try {
      const { createSupplierAction } = await import("@/app/(app)/suppliers/actions")
      const fd = new FormData()
      fd.set("name", trimmed)
      if (phone.trim()) fd.set("phone", phone.trim())
      if (city.trim()) fd.set("city", city.trim())
      const result = await createSupplierAction(fd)
      if (result?.error || !result?.id) {
        setError(result?.error ?? "Tedarikçi oluşturulamadı")
        return
      }
      onCreated({ id: result.id, name: trimmed, phone: phone.trim() || null })
      reset()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Yeni Tedarikçi</DialogTitle>
          <DialogDescription className="text-xs">
            Cari kaydı hemen açılır; detayları sonra Tedarikçiler ekranından tamamlayabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="quick-supplier-name">Tedarikçi Adı *</Label>
            <Input
              id="quick-supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Yılmaz Otomotiv"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-supplier-phone">Telefon</Label>
              <Input
                id="quick-supplier-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-supplier-city">Şehir</Label>
              <Input
                id="quick-supplier-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Opsiyonel"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={handleSubmit} disabled={pending} className="flex-1 sm:flex-none">
            {pending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Plus className="size-3.5 mr-1" />}
            Oluştur
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            İptal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
