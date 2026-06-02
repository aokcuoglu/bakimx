"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CustomerTagBadge, PriceGroupBadge } from "@/components/app/customer-badges"
import { createCustomerAction, updateCustomerAction } from "@/app/app/customers/actions"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils-client"

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

export function CustomerCreateForm({ initial, mode = "create" }: { initial?: CustomerFormInitial | CustomerFormInitialStrict; mode?: "create" | "edit" }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<"individual" | "corporate">(initial?.type === "corporate" ? "corporate" : "individual")
  const [tag, setTag] = useState<string>(initial?.tag || "standard")
  const [source, setSource] = useState<string>(initial?.source || "")
  const [priceGroup, setPriceGroup] = useState<string>(initial?.priceGroup || "standard")
  const [discountRate, setDiscountRate] = useState<string>(
    initial?.discountRate != null ? String(initial.discountRate) : "0"
  )
  const [whatsappConsent, setWhatsappConsent] = useState<boolean>(!!initial?.whatsappConsent)
  const [smsConsent, setSmsConsent] = useState<boolean>(!!initial?.smsConsent)
  const [emailConsent, setEmailConsent] = useState<boolean>(!!initial?.emailConsent)
  const [kvkkApprovedAt, setKvkkApprovedAt] = useState<string>(
    initial?.kvkkApprovedAt ? initial.kvkkApprovedAt.slice(0, 10) : ""
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.set("type", type)
    formData.set("tag", tag)
    formData.set("source", source)
    formData.set("priceGroup", priceGroup)
    formData.set("discountRate", discountRate)
    if (whatsappConsent) formData.set("whatsappConsent", "on")
    if (smsConsent) formData.set("smsConsent", "on")
    if (emailConsent) formData.set("emailConsent", "on")
    if (kvkkApprovedAt) formData.set("kvkkApprovedAt", kvkkApprovedAt)
    try {
      const result =
        mode === "edit" && initial?.id
          ? await updateCustomerAction(initial.id, formData)
          : await createCustomerAction(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      if (mode === "edit" && initial?.id) {
        router.push(`/app/customers/${initial.id}`)
        router.refresh()
        return
      }
      router.push("/app/customers")
      router.refresh()
    } catch {
      setError("Bir hata oluştu")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <header className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Temel Bilgiler</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bireysel veya kurumsal müşteri seçimi</p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setType("individual")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all touch-manipulation",
                    type === "individual"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <UserIcon className="size-3.5" />
                  Bireysel
                </button>
                <button
                  type="button"
                  onClick={() => setType("corporate")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all touch-manipulation",
                    type === "corporate"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Building2 className="size-3.5" />
                  Kurumsal
                </button>
              </div>
            </header>

            {type === "individual" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Ad" htmlFor="firstName" required>
                  <Input id="firstName" name="firstName" defaultValue={initial?.firstName || ""} placeholder="Ahmet" />
                </Field>
                <Field label="Soyad" htmlFor="lastName" required>
                  <Input id="lastName" name="lastName" defaultValue={initial?.lastName || ""} placeholder="Yılmaz" />
                </Field>
                <Field label="Telefon" htmlFor="phone" required>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    defaultValue={initial?.phone || ""}
                    placeholder="0555 123 4567"
                  />
                </Field>
                <Field label="Telefon 2" htmlFor="phone2">
                  <Input
                    id="phone2"
                    name="phone2"
                    type="tel"
                    defaultValue={initial?.phone2 || ""}
                    placeholder="0555 987 6543"
                  />
                </Field>
                <Field label="E-posta" htmlFor="email" className="sm:col-span-2">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={initial?.email || ""}
                    placeholder="ornek@email.com"
                  />
                </Field>
                <Field label="İl" htmlFor="city">
                  <Input id="city" name="city" defaultValue={initial?.city || ""} placeholder="İstanbul" />
                </Field>
                <Field label="İlçe" htmlFor="district">
                  <Input id="district" name="district" defaultValue={initial?.district || ""} placeholder="Kadıköy" />
                </Field>
                <Field label="Adres" htmlFor="address" className="sm:col-span-2">
                  <Textarea
                    id="address"
                    name="address"
                    defaultValue={initial?.address || ""}
                    placeholder="Mahalle / Sokak / No"
                    rows={2}
                  />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Şirket Adı" htmlFor="companyName" required>
                  <Input
                    id="companyName"
                    name="companyName"
                    defaultValue={initial?.companyName || ""}
                    placeholder="ABC Lojistik A.Ş."
                  />
                </Field>
                <Field label="Yetkili Kişi" htmlFor="contactName">
                  <Input
                    id="contactName"
                    name="contactName"
                    defaultValue={initial?.contactName || ""}
                    placeholder="Mehmet Bey"
                  />
                </Field>
                <Field label="Telefon" htmlFor="phone" required>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    defaultValue={initial?.phone || ""}
                    placeholder="0212 555 0000"
                  />
                </Field>
                <Field label="Telefon 2" htmlFor="phone2">
                  <Input
                    id="phone2"
                    name="phone2"
                    type="tel"
                    defaultValue={initial?.phone2 || ""}
                    placeholder="0555 987 6543"
                  />
                </Field>
                <Field label="E-posta" htmlFor="email" className="sm:col-span-2">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={initial?.email || ""}
                    placeholder="info@sirket.com"
                  />
                </Field>
                <Field label="İl" htmlFor="city">
                  <Input id="city" name="city" defaultValue={initial?.city || ""} placeholder="İstanbul" />
                </Field>
                <Field label="İlçe" htmlFor="district">
                  <Input id="district" name="district" defaultValue={initial?.district || ""} placeholder="Kadıköy" />
                </Field>
                <Field label="Adres" htmlFor="address" className="sm:col-span-2">
                  <Textarea
                    id="address"
                    name="address"
                    defaultValue={initial?.address || ""}
                    placeholder="Mahalle / Sokak / No"
                    rows={2}
                  />
                </Field>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <header>
              <h3 className="text-sm font-semibold text-slate-900">Vergi / Kimlik Bilgileri</h3>
              <p className="text-xs text-slate-500 mt-0.5">Fatura ve resmi kayıtlar için</p>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="TC Kimlik No" htmlFor="identityNumber">
                <Input
                  id="identityNumber"
                  name="identityNumber"
                  defaultValue={initial?.identityNumber || ""}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="12345678901"
                />
              </Field>
              <Field label="Vergi No" htmlFor="taxNumber">
                <Input
                  id="taxNumber"
                  name="taxNumber"
                  defaultValue={initial?.taxNumber || ""}
                  inputMode="numeric"
                  placeholder="1234567890"
                />
              </Field>
              <Field label="Vergi Dairesi" htmlFor="taxOffice">
                <Input
                  id="taxOffice"
                  name="taxOffice"
                  defaultValue={initial?.taxOffice || ""}
                  placeholder="Kadıköy VD"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <header className="flex items-center gap-2">
              <FileText className="size-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Müşteri Notu</h3>
            </header>
            <Textarea
              name="notes"
              defaultValue={initial?.notes || ""}
              rows={4}
              placeholder="Bu müşteriye özel notlar (iç kullanım). Müşteri çıktısında gösterilmez."
            />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <header>
              <h3 className="text-sm font-semibold text-slate-900">Müşteri Profili</h3>
              <p className="text-xs text-slate-500 mt-0.5">Etiket, kaynak, fiyat grubu</p>
            </header>
            <div className="space-y-3">
              <Field label="Etiket" htmlFor="tag">
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
                      onClick={() => setTag(opt.key)}
                      className={cn(
                        "inline-flex items-center px-2.5 h-8 rounded-md border text-xs font-medium transition-colors touch-manipulation",
                        tag === opt.key
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Önizleme: <CustomerTagBadge tag={tag} />
                </p>
              </Field>
              <Field label="Müşteri Kaynağı" htmlFor="source">
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="">Seçilmedi</option>
                  <option value="referral">Tavsiye</option>
                  <option value="google">Google</option>
                  <option value="social_media">Sosyal Medya</option>
                  <option value="walk_in">Yoldan Geldi</option>
                  <option value="existing">Mevcut Müşteri</option>
                  <option value="other">Diğer</option>
                </select>
              </Field>
              <Field label="Fiyat Grubu" htmlFor="priceGroup">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "standard", label: "Standart" },
                    { key: "discounted", label: "İndirimli" },
                    { key: "fleet", label: "Filo" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPriceGroup(opt.key)}
                      className={cn(
                        "inline-flex items-center px-2.5 h-8 rounded-md border text-xs font-medium transition-colors touch-manipulation",
                        priceGroup === opt.key
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {priceGroup ? (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Önizleme: <PriceGroupBadge group={priceGroup} />
                  </p>
                ) : null}
              </Field>
              <Field label="İndirim %" htmlFor="discountRate">
                <Input
                  id="discountRate"
                  name="discountRate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value)}
                  className="max-w-[10rem]"
                />
                <p className="text-[11px] text-slate-400 mt-1">0–100 arası. İş emri kalemlerine uygulanır.</p>
              </Field>
              <Field label="Risk / Uyarı Notu" htmlFor="riskNote">
                <Textarea
                  id="riskNote"
                  name="riskNote"
                  defaultValue={initial?.riskNote || ""}
                  rows={3}
                  placeholder="Örn: Ödemelerde gecikme yaşanabilir, dikkatli olun."
                />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <header className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">İletişim İzinleri</h3>
            </header>
            <div className="space-y-2">
              <ConsentRow
                label="WhatsApp izni var"
                icon={<MessageCircle className="size-4 text-emerald-600" />}
                checked={whatsappConsent}
                onChange={setWhatsappConsent}
              />
              <ConsentRow
                label="SMS izni var"
                icon={<Smartphone className="size-4 text-sky-600" />}
                checked={smsConsent}
                onChange={setSmsConsent}
              />
              <ConsentRow
                label="E-posta izni var"
                icon={<Mail className="size-4 text-indigo-600" />}
                checked={emailConsent}
                onChange={setEmailConsent}
              />
            </div>
            <div className="pt-2 border-t border-slate-100">
              <Label htmlFor="kvkkApprovedAt" className="text-xs">KVKK Onay Tarihi</Label>
              <Input
                id="kvkkApprovedAt"
                type="date"
                value={kvkkApprovedAt}
                onChange={(e) => setKvkkApprovedAt(e.target.value)}
                className="mt-1.5"
              />
              {kvkkApprovedAt ? (
                <p className="text-[11px] text-slate-400 mt-1">Onay: {formatDate(kvkkApprovedAt)}</p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Henüz kaydedilmedi</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="size-4 text-slate-400 mt-0.5" />
              <div className="text-xs text-slate-600">
                <p className="font-medium text-slate-700">Sesle Doldur</p>
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

      <div className="lg:hidden sticky bottom-0 left-0 right-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          İptal
        </Button>
        <Button type="submit" disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {mode === "edit" ? "Güncelle" : "Müşteri Kaydet"}
        </Button>
      </div>

      <div className="hidden lg:flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          İptal
        </Button>
        <Button type="submit" disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {mode === "edit" ? "Güncelle" : "Müşteri Kaydet"}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <Phone className="size-3" />
        <span>Telefon numaraları otomatik olarak +90 formatına normalleştirilir.</span>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs text-slate-600">
        {label}
        {required ? <span className="text-rose-500 ml-0.5">*</span> : null}
      </Label>
      {children}
    </div>
  )
}

function ConsentRow({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string
  icon: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 cursor-pointer touch-manipulation">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        {icon}
        <span>{label}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
    </label>
  )
}
