"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  Loader2,
  Wallet,
  CreditCard,
  Building2,
  CircleDot,
  Check,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PaymentBadge } from "@/components/shared/status-badge"
import { computePaymentStatus } from "@/lib/cashbox/status"
import { formatTRY } from "@/lib/format"
import { kurusToLira, liraToKurus } from "@/lib/money"
import { typedResolver } from "@/lib/validations/resolver"
import { collectionSchema, type CollectionFormValues } from "@/lib/validations/collection"
import { cn } from "@/lib/utils"

const METHODS = [
  { key: "cash", label: "Nakit", icon: Wallet },
  { key: "credit_card", label: "Kredi Kartı", icon: CreditCard },
  { key: "bank_transfer", label: "Havale/EFT", icon: Building2 },
  { key: "other", label: "Diğer", icon: CircleDot },
] as const

function localDateTimeValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  customerId: string
  grandTotal: number
  paidAmount: number
  remainingAmount: number
}

/**
 * İş emri içinden hızlı tahsilat girişi. Müşteri ve iş emri sabit geldiği için
 * seçim adımları yoktur; kayıt sonrası sayfadan çıkılmaz (router.refresh).
 */
export function CollectionQuickModal({
  open,
  onOpenChange,
  orderId,
  customerId,
  grandTotal,
  paidAmount,
  remainingAmount,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const form = useForm<CollectionFormValues, unknown, CollectionFormValues>({
    resolver: typedResolver(collectionSchema),
    defaultValues: {
      customerId,
      serviceOrderId: orderId,
      amount: remainingAmount > 0 ? kurusToLira(remainingAmount) : 0,
      method: "cash",
      paymentDate: localDateTimeValue(),
      referenceNo: "",
      note: "",
    },
  })

  const amount = form.watch("amount")
  const amountNum = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0
  const amountKurus = liraToKurus(amountNum)
  const newRemaining = Math.max(0, grandTotal - paidAmount - amountKurus)
  const projectedStatus = computePaymentStatus(grandTotal, paidAmount + amountKurus)
  const isOverpayment = amountKurus > remainingAmount && remainingAmount > 0

  // Modal her açılışta güncel kalan bakiye/tarih ile sıfırlanır (kayıt sonrası
  // router.refresh ile gelen yeni tutarlar dahil).
  useEffect(() => {
    if (!open) return
    setError("")
    form.reset({
      customerId,
      serviceOrderId: orderId,
      amount: remainingAmount > 0 ? kurusToLira(remainingAmount) : 0,
      method: "cash",
      paymentDate: localDateTimeValue(),
      referenceNo: "",
      note: "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId, orderId, remainingAmount])

  function handleOpenChange(next: boolean) {
    if (loading) return
    onOpenChange(next)
  }

  async function onSubmit(values: CollectionFormValues) {
    setLoading(true)
    setError("")

    const formData = new FormData()
    formData.set("customerId", customerId)
    formData.set("serviceOrderId", orderId)
    formData.set("amount", String(liraToKurus(values.amount)))
    formData.set("method", values.method)
    formData.set("paymentDate", new Date(values.paymentDate).toISOString())
    formData.set("referenceNo", values.referenceNo || "")
    formData.set("note", values.note || "")

    try {
      const res = await fetch("/api/cashbox/collections", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        toast.success(`${formatTRY(liraToKurus(values.amount))} tahsilat kaydedildi`)
        onOpenChange(false)
        router.refresh()
      } else {
        setError(data.error || "Tahsilat kaydedilemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              Tahsilat Ekle
            </span>
          </DialogTitle>
          <DialogDescription>
            Kalan bakiye {formatTRY(remainingAmount)}. Kayıt bu iş emrine işlenir.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs font-medium text-muted-foreground">Tutar (₺) *</FormLabel>
                    {remainingAmount > 0 && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={() => field.onChange(kurusToLira(remainingAmount))}
                      >
                        Kalanı öde ({formatTRY(remainingAmount)})
                      </Button>
                    )}
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="0.00"
                      className="mt-1.5 text-lg font-semibold"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Ödeme Yöntemi *</FormLabel>
                  <FormControl>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {METHODS.map((m) => {
                        const Icon = m.icon
                        return (
                          <Button
                            key={m.key}
                            type="button"
                            variant={field.value === m.key ? "default" : "outline"}
                            className="justify-start"
                            onClick={() => field.onChange(m.key)}
                          >
                            <Icon className="size-4 mr-2" />
                            {m.label}
                          </Button>
                        )
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">Tahsilat Tarihi *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} className="mt-1.5" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="referenceNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">Referans No</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Opsiyonel" className="mt-1.5" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Not</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Opsiyonel not" className="mt-1.5" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Genel Toplam</span>
                <span className="font-medium text-foreground">{formatTRY(grandTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Daha Önce Tahsil Edilen</span>
                <span className="font-medium text-success">{formatTRY(paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t pt-1.5">
                <span className="text-muted-foreground font-medium">Kalan (tahsilat sonrası)</span>
                <span className={cn("font-bold", newRemaining > 0 ? "text-destructive" : "text-foreground")}>
                  {formatTRY(newRemaining)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ödeme Durumu</span>
                <PaymentBadge status={projectedStatus} size="md" />
              </div>
              {isOverpayment && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                  <Info className="size-3.5 mt-0.5 shrink-0" />
                  <span>Fazla ödeme: kalan bakiyeyi {formatTRY(amountKurus - remainingAmount)} aşıyor</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
                Tahsilatı Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
