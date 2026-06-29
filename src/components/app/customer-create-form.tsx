"use client"

import { useActionState, useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"
import { percentToBps, bpsToPercent } from "@/lib/money"
import {
  Building2,
  User as UserIcon,
  Save,
  Mic,
  Info,
  Mail,
  Phone,
  MessageCircle,
  Smartphone,
  ShieldCheck,
  FileText,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CustomerTagBadge, PriceGroupBadge } from "@/components/app/customer-badges"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createCustomerAction, updateCustomerAction } from "@/app/(app)/customers/actions"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils-client"
import { useForm } from "react-hook-form"
import { customerSchema, type CustomerFormValues } from "@/lib/validations/customer"
import { typedResolver } from "@/lib/validations/resolver"

export type CustomerFormInitial = {
  id?: string
  type?: "individual" | "corporate"
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  companyName?: string | null
  contactName?: string | null
  phone?: string | null
  phone2?: string | null
  email?: string | null
  city?: string | null
  district?: string | null
  address?: string | null
  identityNumber?: string | null
  taxNumber?: string | null
  taxOffice?: string | null
  notes?: string | null
  tag?: string | null
  source?: string | null
  priceGroup?: string | null
  discountRate?: number | null
  riskNote?: string | null
  whatsappConsent?: boolean
  smsConsent?: boolean
  emailConsent?: boolean
  kvkkApprovedAt?: string | null
}

type CustomerFormInitialStrict = Omit<CustomerFormInitial, "whatsappConsent" | "smsConsent" | "emailConsent"> & {
  whatsappConsent: boolean
  smsConsent: boolean
  emailConsent: boolean
}

function toDefaults(initial?: CustomerFormInitial | CustomerFormInitialStrict): CustomerFormValues {
  return {
    type: initial?.type === "corporate" ? "corporate" : "individual",
    firstName: initial?.firstName || "",
    lastName: initial?.lastName || "",
    fullName: initial?.fullName || "",
    companyName: initial?.companyName || "",
    contactName: initial?.contactName || "",
    phone: initial?.phone || "",
    phone2: initial?.phone2 || "",
    email: initial?.email || "",
    city: initial?.city || "",
    district: initial?.district || "",
    address: initial?.address || "",
    identityNumber: initial?.identityNumber || "",
    taxNumber: initial?.taxNumber || "",
    taxOffice: initial?.taxOffice || "",
    notes: initial?.notes || "",
    riskNote: initial?.riskNote || "",
    tag: initial?.tag || "standard",
    source: initial?.source || "",
    priceGroup: initial?.priceGroup || "standard",
    discountRate: initial?.discountRate != null ? bpsToPercent(initial.discountRate) : 0, // bps -> percent for the input
    whatsappConsent: !!initial?.whatsappConsent,
    smsConsent: !!initial?.smsConsent,
    emailConsent: !!initial?.emailConsent,
    kvkkApprovedAt: initial?.kvkkApprovedAt ? initial.kvkkApprovedAt.slice(0, 10) : "",
  }
}

export function CustomerCreateForm({ initial, mode = "create" }: { initial?: CustomerFormInitial | CustomerFormInitialStrict; mode?: "create" | "edit" }) {
  const router = useRouter()
  const isEdit = mode === "edit" && !!initial?.id

  const form = useForm<CustomerFormValues, unknown, CustomerFormValues>({
    resolver: typedResolver(customerSchema),
    defaultValues: toDefaults(initial),
  })

  const type = form.watch("type")
  const tag = form.watch("tag")
  const priceGroup = form.watch("priceGroup")
  const kvkkApprovedAt = form.watch("kvkkApprovedAt")

  type ActionState = { error?: string; success?: boolean; id?: string }

  const action = async (_prev: ActionState | null, formData: FormData): Promise<ActionState | null> => {
    if (isEdit && initial?.id) {
      return updateCustomerAction(initial.id, formData) as unknown as ActionState | null
    }
    return createCustomerAction(formData) as unknown as ActionState | null
  }

  const [state, formAction, pending] = useActionState(action, null as ActionState | null)

  useEffect(() => {
    if (state?.success) {
      if (isEdit && initial?.id) {
        router.push(`/customers/${initial.id}`)
      } else if (state.id) {
        router.push(`/customers/${state.id}`)
      } else {
        router.push("/customers")
      }
      router.refresh()
    }
  }, [state, router, isEdit, initial?.id])

  function onSubmit(values: CustomerFormValues) {
    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "boolean") {
        if (value) formData.set(key, "on")
      } else {
        formData.set(key, String(value))
      }
    }
    // discountRate is entered as a percent but stored as bps.
    formData.set("discountRate", String(percentToBps(Number(values.discountRate) || 0)))
    startTransition(() => formAction(formData))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <section className="rounded-lg border border-border bg-white p-4 sm:p-5 space-y-4">
              <header className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Temel Bilgiler</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Bireysel veya kurumsal müşteri seçimi</p>
                </div>
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => field.onChange("individual")}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all touch-manipulation",
                          field.value === "individual"
                            ? "bg-white text-foreground shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <UserIcon className="size-3.5" />
                        Bireysel
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("corporate")}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all touch-manipulation",
                          field.value === "corporate"
                            ? "bg-white text-foreground shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Building2 className="size-3.5" />
                        Kurumsal
                      </button>
                    </div>
                  )}
                />
              </header>

              {type === "individual" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ad *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ahmet" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Soyad *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Yılmaz" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon *</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="0555 123 4567" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon 2</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="0555 987 6543" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>E-posta</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="ornek@email.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İl</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="İstanbul" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İlçe</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Kadıköy" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Adres</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Mahalle / Sokak / No" rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Şirket Adı *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ABC Lojistik A.Ş." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Yetkili Kişi</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Mehmet Bey" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon *</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="0212 555 0000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon 2</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="0555 987 6543" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>E-posta</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="info@sirket.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İl</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="İstanbul" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>İlçe</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Kadıköy" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Adres</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Mahalle / Sokak / No" rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-white p-4 sm:p-5 space-y-4">
              <header>
                <h3 className="text-sm font-semibold text-foreground">Vergi / Kimlik Bilgileri</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Fatura ve resmi kayıtlar için</p>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="identityNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TC Kimlik No</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" maxLength={11} placeholder="12345678901" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergi No</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" placeholder="1234567890" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxOffice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergi Dairesi</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Kadıköy VD" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-white p-4 sm:p-5 space-y-3">
              <header className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Müşteri Notu</h3>
              </header>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} rows={4} placeholder="Bu müşteriye özel notlar (iç kullanım). Müşteri çıktısında gösterilmez." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-border bg-white p-4 sm:p-5 space-y-4">
              <header>
                <h3 className="text-sm font-semibold text-foreground">Müşteri Profili</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Etiket, kaynak, fiyat grubu</p>
              </header>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="tag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Etiket</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { key: "standard", label: "Standart" },
                            { key: "vip", label: "VIP" },
                            { key: "risky", label: "Riskli" },
                            { key: "fleet", label: "Filo" },
                          ].map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => field.onChange(opt.key)}
                              className={cn(
                                "inline-flex items-center px-2.5 h-8 rounded-md border text-xs font-medium transition-colors touch-manipulation",
                                field.value === opt.key
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-white text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                        Önizleme: <CustomerTagBadge tag={tag} />
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri Kaynağı</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seçilmedi" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Seçilmedi</SelectItem>
                            <SelectItem value="referral">Tavsiye</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="social_media">Sosyal Medya</SelectItem>
                            <SelectItem value="walk_in">Yoldan Geldi</SelectItem>
                            <SelectItem value="existing">Mevcut Müşteri</SelectItem>
                            <SelectItem value="other">Diğer</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priceGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiyat Grubu</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { key: "standard", label: "Standart" },
                            { key: "discounted", label: "İndirimli" },
                            { key: "fleet", label: "Filo" },
                          ].map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => field.onChange(opt.key)}
                              className={cn(
                                "inline-flex items-center px-2.5 h-8 rounded-md border text-xs font-medium transition-colors touch-manipulation",
                                field.value === opt.key
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-white text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      {priceGroup ? (
                        <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                          Önizleme: <PriceGroupBadge group={priceGroup} />
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discountRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>İndirim %</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          className="max-w-[10rem]"
                        />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">0–100 arası. İş emri kalemlerine uygulanır.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="riskNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risk / Uyarı Notu</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Örn: Ödemelerde gecikme yaşanabilir, dikkatli olun." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-white p-4 sm:p-5 space-y-3">
              <header className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">İletişim İzinleri</h3>
              </header>
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="whatsappConsent"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2 cursor-pointer touch-manipulation">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <MessageCircle className="size-4 text-success" />
                          <span>WhatsApp izni var</span>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(c) => field.onChange(c)}
                          />
                        </FormControl>
                      </label>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="smsConsent"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2 cursor-pointer touch-manipulation">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Smartphone className="size-4 text-primary" />
                          <span>SMS izni var</span>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(c) => field.onChange(c)}
                          />
                        </FormControl>
                      </label>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emailConsent"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2 cursor-pointer touch-manipulation">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Mail className="size-4 text-primary" />
                          <span>E-posta izni var</span>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(c) => field.onChange(c)}
                          />
                        </FormControl>
                      </label>
                    </FormItem>
                  )}
                />
              </div>
              <div className="pt-2 border-t border-border">
                <FormField
                  control={form.control}
                  name="kvkkApprovedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">KVKK Onay Tarihi</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="mt-1.5" />
                      </FormControl>
                      {kvkkApprovedAt ? (
                        <p className="text-[11px] text-muted-foreground/70 mt-1">Onay: {formatDate(kvkkApprovedAt)}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/70 mt-1">Henüz kaydedilmedi</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-muted p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="size-4 text-muted-foreground/70 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Sesle Doldur</p>
                  <p className="mt-0.5">Sesle doldurma özelliği yakında. Şimdilik formu manuel doldurun.</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled className="w-full gap-1.5">
                <Mic className="size-4" />
                Sesle Doldur (Yakında)
              </Button>
            </section>
          </aside>
        </div>

        <div className="lg:hidden sticky bottom-0 left-0 right-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-border flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {mode === "edit" ? "Güncelle" : "Müşteri Kaydet"}
          </Button>
        </div>

        <div className="hidden lg:flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            İptal
          </Button>
          <Button type="submit" disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {mode === "edit" ? "Güncelle" : "Müşteri Kaydet"}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
          <Phone className="size-3" />
          <span>Telefon numaraları otomatik olarak +90 formatına normalleştirilir.</span>
        </div>
      </form>
    </Form>
  )
}