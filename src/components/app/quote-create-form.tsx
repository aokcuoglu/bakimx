"use client"

import { useState, useCallback, useEffect, useActionState, startTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Plus, Trash2, Loader2, Calculator } from "lucide-react"
import { StockStatusBadge } from "@/components/app/stock-status-badge"
import { formatPrice } from "@/lib/parts/format"
import { cn } from "@/lib/utils"
import { createQuoteAction } from "@/app/(app)/quotes/actions"
import { customerDisplayName } from "@/lib/format"
import { formatTRY } from "@/lib/format"
import { useForm, useFieldArray } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import {
  quoteSchema,
  type QuoteFormValues,
} from "@/lib/validations/quote"

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}

type Vehicle = {
  id: string
  plate: string
  brand: string
  model: string
}

type ActionState = {
  error?: string
  success?: boolean
  id?: string
}

type CatalogPart = {
  id: string
  name: string
  sku: string | null
  stockQty: number
  criticalStockQty: number
  salePrice: number | null
  unit: string
  isActive: boolean
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  part: "Parça",
  labor: "İşçilik",
}

const defaultItem = {
  type: "part" as const,
  name: "",
  quantity: 1,
  unitPrice: null as number | null,
  totalPrice: null as number | null,
  note: "",
}

export function QuoteCreateForm() {
  const router = useRouter()
  const wrappedAction = async (
    _prev: ActionState | null,
    formData: FormData,
  ): Promise<ActionState | null> => {
    return createQuoteAction(formData) as unknown as Promise<ActionState | null>
  }
  const [state, formAction, pending] = useActionState(wrappedAction, null as ActionState | null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [vehicleLoading, setVehicleLoading] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [catalogResults, setCatalogResults] = useState<CatalogPart[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"draft" | "sent">("sent")

  const form = useForm<QuoteFormValues, unknown, QuoteFormValues>({
    resolver: typedResolver(quoteSchema),
    defaultValues: {
      customerId: "",
      vehicleId: "",
      title: "",
      customerRequest: "",
      internalNote: "",
      validUntil: "",
      status: "draft",
      discountAmount: "0",
      taxRate: "20",
      items: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const customerId = form.watch("customerId")
  const discountAmount = form.watch("discountAmount")
  const taxRate = form.watch("taxRate")
  const itemsWatch = form.watch("items")

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/quotes/${state.id}`)
    }
  }, [state, router])

  const fetchCustomers = useCallback(async (search: string) => {
    setCustomerLoading(true)
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(search)}&limit=20`)
      const data = await res.json()
      if (data.customers) setCustomers(data.customers)
    } catch {
      // ignore
    } finally {
      setCustomerLoading(false)
    }
  }, [])

  const fetchVehicles = useCallback(async (custId: string) => {
    setVehicleLoading(true)
    form.setValue("vehicleId", "")
    try {
      const res = await fetch(`/api/customers/${custId}/vehicles`)
      const data = await res.json()
      if (data.vehicles) setVehicles(data.vehicles)
      else setVehicles([])
    } catch {
      setVehicles([])
    } finally {
      setVehicleLoading(false)
    }
  }, [form])

  function handleCustomerSelect(id: string) {
    form.setValue("customerId", id)
    setCustomerSearch("")
    setCustomerSearchOpen(false)
    const c = customers.find((c) => c.id === id)
    if (c) setCustomerSearch(customerDisplayName(c))
    fetchVehicles(id)
  }

  function handleCustomerSearchChange(value: string) {
    setCustomerSearch(value)
    setCustomerSearchOpen(true)
    if (value.length >= 1) fetchCustomers(value)
    else setCustomers([])
  }

  function addItem() {
    append({ ...defaultItem })
  }

  async function searchCatalog(query: string) {
    if (query.length < 1) {
      setCatalogResults([])
      return
    }
    setCatalogLoading(true)
    try {
      const res = await fetch(`/api/parts/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.parts) setCatalogResults(data.parts)
    } catch {
      /* ignore */
    } finally {
      setCatalogLoading(false)
    }
  }

  function selectCatalogPart(part: CatalogPart) {
    append({
      ...defaultItem,
      name: part.name,
      unitPrice: part.salePrice,
      totalPrice: part.salePrice ? part.salePrice * 1 : null,
      note: part.sku ? `SKU: ${part.sku}` : "",
    })
    setCatalogSearch("")
    setCatalogResults([])
  }

  function recomputeTotal(index: number) {
    const current = form.getValues(`items.${index}`)
    const qty = Number(current?.quantity) || 0
    const price = Number(current?.unitPrice) || 0
    if (qty > 0 && price > 0) {
      form.setValue(`items.${index}.totalPrice`, qty * price, { shouldDirty: true })
    }
  }

  const partsTotal = itemsWatch
    .filter((i) => i.type === "part")
    .reduce((sum, i) => sum + (i.totalPrice ?? 0), 0)
  const laborTotal = itemsWatch
    .filter((i) => i.type === "labor")
    .reduce((sum, i) => sum + (i.totalPrice ?? 0), 0)
  const subtotal = partsTotal + laborTotal
  const discount = Math.max(0, Number(discountAmount) || 0)
  const afterDiscount = Math.max(0, subtotal - discount)
  const tax = (afterDiscount * (Number(taxRate) || 0)) / 100
  const grandTotal = afterDiscount + tax

  function onSubmit(values: QuoteFormValues) {
    if (!values.customerId) return
    const formData = new FormData()
    formData.set("customerId", values.customerId)
    formData.set("vehicleId", values.vehicleId || "")
    formData.set("title", values.title || "")
    formData.set("customerRequest", values.customerRequest || "")
    formData.set("internalNote", values.internalNote || "")
    formData.set("validUntil", values.validUntil || "")
    formData.set("discountAmount", values.discountAmount || "0")
    formData.set("taxRate", values.taxRate || "0")
    formData.set("estimatedPartsTotal", String(partsTotal))
    formData.set("estimatedLaborTotal", String(laborTotal))
    formData.set("grandTotal", String(grandTotal))
    formData.set("status", submitStatus)
    const cleanItems = values.items
      .filter((i) => i.name.trim())
      .map((i) => ({
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice != null && i.unitPrice > 0 ? i.unitPrice : undefined,
        totalPrice: i.totalPrice != null && i.totalPrice > 0 ? i.totalPrice : undefined,
        note: i.note || undefined,
      }))
    formData.set("items", JSON.stringify(cleanItems))
    startTransition(() => formAction(formData))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {state?.error && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Müşteri & Araç</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            value={customerSearch}
                            onChange={(e) => handleCustomerSearchChange(e.target.value)}
                            onFocus={() => {
                              if (customers.length === 0 && customerSearch.length < 1) {
                                fetchCustomers("")
                              }
                              setCustomerSearchOpen(true)
                            }}
                            placeholder="Müşteri adı, telefon veya plaka ile ara..."
                            autoComplete="off"
                          />
                          <input type="hidden" ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} />
                          {customerSearchOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                              {customerLoading ? (
                                <div className="flex items-center justify-center py-3">
                                  <Loader2 className="size-4 animate-spin text-muted-foreground/70" />
                                </div>
                              ) : customers.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">Müşteri bulunamadı</div>
                              ) : (
                                customers.map((c) => (
                                  <Button
                                    key={c.id}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleCustomerSelect(c.id)}
                                    className="w-full justify-start rounded-none px-3 py-2 h-auto font-medium"
                                  >
                                    <span className="font-medium text-foreground">{customerDisplayName(c)}</span>
                                    <span className="text-muted-foreground ml-2">{c.phone}</span>
                                  </Button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Araç</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={vehicleLoading ? "Yükleniyor..." : "Araç seçin (isteğe bağlı)"}>
                              {(value: string | null) => {
                                if (!value) return null
                                const v = vehicles.find((v) => v.id === value)
                                return v ? `${v.plate} — ${v.brand} ${v.model}` : value
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.plate} — {v.brand} {v.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-3 text-xs">
                  <Button
                    nativeButton={false}
                    variant="link"
                    size="xs"
                    className="h-auto p-0"
                    render={<Link href="/customers/new" />}
                  >
                    + Yeni Müşteri
                  </Button>
                  {customerId && (
                    <Button
                      nativeButton={false}
                      variant="link"
                      size="xs"
                      className="h-auto p-0"
                      render={<Link href={`/vehicles/new?customerId=${customerId}`} />}
                    >
                      + Yeni Araç
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Teklif Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teklif Başlığı</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Örn: Periyodik Bakım Teklifi" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerRequest"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri Talebi</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Müşterinin belirttiği istek veya şikayetler..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Geçerlilik Tarihi</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="internalNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>İç Not</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="İç kullanım notu (müşteriye gösterilmez)..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Parça & İşçilik Kalemleri</CardTitle>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1">
                      <Plus className="size-3.5" />
                      Kalem Ekle
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={catalogSearch}
                        onChange={(e) => {
                          setCatalogSearch(e.target.value)
                          searchCatalog(e.target.value)
                        }}
                        placeholder="Katalogdan parça ara ve ekle..."
                      />
                      {catalogLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">
                          Aranıyor...
                        </span>
                      )}
                    </div>
                  </div>
                  {catalogResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background shadow-sm">
                      {catalogResults.map((p) => (
                        <Button
                          key={p.id}
                          type="button"
                          variant="ghost"
                          onClick={() => selectCatalogPart(p)}
                          className="w-full justify-between rounded-none border-b border-border last:border-0 h-auto py-2 px-3"
                        >
                          <div className="min-w-0 flex-1 text-left">
                            <span className="font-medium text-foreground">{p.name}</span>
                            {p.sku && <span className="text-xs text-muted-foreground ml-2 font-mono">{p.sku}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StockStatusBadge stockQty={p.stockQty} criticalStockQty={p.criticalStockQty} isActive={p.isActive} />
                            {p.salePrice != null && (
                              <span className="text-xs font-medium text-foreground">{formatPrice(p.salePrice)}</span>
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {fields.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    Henüz kalem eklenmedi. &quot;Kalem Ekle&quot; butonuna tıklayarak başlayın.
                  </div>
                )}
                {fields.map((itemField, index) => (
                  <div key={itemField.id} className="rounded-lg border border-border bg-muted/50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <FormField
                          control={form.control}
                          name={`items.${index}.type`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "part")}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Tip">
                                      {(value: string | null) => (value ? ITEM_TYPE_LABELS[value] ?? value : null)}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="part">Parça</SelectItem>
                                    <SelectItem value="labor">İşçilik</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-[11px] text-muted-foreground/70 font-mono">{itemField.id}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(index)}
                        aria-label="Kalemi sil"
                        className="text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.name`}
                        render={({ field }) => {
                          const typeVal = form.getValues(`items.${index}.type`)
                          return (
                            <FormItem className="sm:col-span-2">
                              <FormLabel className="text-[11px] text-muted-foreground">Ad</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={typeVal === "part" ? "Fren balatası..." : "Yağ değişimi..."}
                                  className="h-8 text-sm"
                                />
                              </FormControl>
                            </FormItem>
                          )
                        }}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] text-muted-foreground">Miktar</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value) || 1)
                                  recomputeTotal(index)
                                }}
                                className="h-8 text-sm"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] text-muted-foreground">Birim Fiyat ₺</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  field.onChange(e.target.value ? Number(e.target.value) : null)
                                  recomputeTotal(index)
                                }}
                                className="h-8 text-sm"
                                placeholder="0"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.totalPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] text-muted-foreground">Tutar ₺</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                className="h-8 text-sm"
                                placeholder="0"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`items.${index}.note`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] text-muted-foreground">Not</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Opsiyonel not..." className="h-8 text-sm" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5">
            <div className="lg:sticky lg:top-24">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calculator className="size-4 text-muted-foreground" />
                    Fiyat Özeti
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <SummaryRow label="Parça Toplamı" value={partsTotal > 0 ? formatTRY(partsTotal) : "—"} muted={partsTotal === 0} />
                  <SummaryRow label="İşçilik Toplamı" value={laborTotal > 0 ? formatTRY(laborTotal) : "—"} muted={laborTotal === 0} />
                  <div className="pt-2 border-t" />
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="discountAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] text-muted-foreground">İndirim (₺)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] text-muted-foreground">KDV Oranı (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              {...field}
                              placeholder="20"
                              className="h-8 text-sm"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <SummaryRow label="İndirim" value={discount > 0 ? `-${formatTRY(discount)}` : "—"} muted={discount === 0} />
                  <SummaryRow label={`KDV (%${Number(taxRate) || 0})`} value={tax > 0 ? formatTRY(tax) : "—"} muted={tax === 0} />
                  <div className="border-t pt-2 mt-2">
                    <SummaryRow label="Genel Toplam" value={subtotal > 0 ? formatTRY(grandTotal) : "—"} bold large />
                  </div>
                </CardContent>
              </Card>

              <div className="hidden lg:flex flex-col gap-2 mt-5">
                <Button
                  type="submit"
                  disabled={pending}
                  className="gap-2 w-full"
                  onClick={() => setSubmitStatus("sent")}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Teklif Kaydet
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending}
                  className="gap-2 w-full"
                  onClick={() => setSubmitStatus("draft")}
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Taslak Kaydet
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                  disabled={pending}
                  className="w-full"
                >
                  İptal
                </Button>
              </div>
            </div>
          </aside>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border p-3 safe-area-bottom flex gap-2">
          <Button
            type="submit"
            disabled={pending}
            className="flex-1 gap-2"
            onClick={() => setSubmitStatus("sent")}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Kaydet
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending} className="flex-1">
            İptal
          </Button>
        </div>
      </form>
    </Form>
  )
}

function SummaryRow({
  label,
  value,
  bold,
  large,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  large?: boolean
  muted?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-muted-foreground", bold && "text-foreground")}>{label}</span>
      <span className={cn(muted ? "text-muted-foreground/70" : "text-foreground", large && "text-lg font-bold text-foreground")}>
        {value}
      </span>
    </div>
  )
}