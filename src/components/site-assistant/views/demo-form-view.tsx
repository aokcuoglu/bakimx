"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ViewHeader } from "./view-header";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TR_CITIES } from "@/lib/tr-cities";
import type { SuccessContext } from "../site-assistant";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

interface DemoFormViewProps {
  onBack: () => void;
  onSuccess: (context: SuccessContext) => void;
}

interface FormData {
  name: string;
  businessName: string;
  phone: string;
  city: string;
  monthlyVehicles: string;
  notes: string;
}

interface FormErrors {
  name?: string;
  businessName?: string;
  phone?: string;
  city?: string;
  monthlyVehicles?: string;
  _general?: string;
}

const EMPTY: FormData = { name: "", businessName: "", phone: "", city: "", monthlyVehicles: "", notes: "" };

const MONTHLY_VEHICLE_OPTIONS = [
  { value: "1-20", label: "1 - 20" },
  { value: "21-50", label: "21 - 50" },
  { value: "51-100", label: "51 - 100" },
  { value: "100+", label: "100+" },
];

export function DemoFormView({ onBack, onSuccess }: DemoFormViewProps) {
  const [data, setData] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (data.name.trim().length < 2) e.name = "Ad Soyad en az 2 karakter olmalıdır";
    if (data.businessName.trim().length < 2) e.businessName = "İşletme adı en az 2 karakter olmalıdır";
    if (!data.phone.trim()) e.phone = "Telefon gerekli";
    else if (!/^[0-9+\-\s()]{7,15}$/.test(data.phone.trim())) e.phone = "Telefon numarası geçersiz görünüyor";
    if (!data.city) e.city = "Şehir seçimi gerekli";
    if (!data.monthlyVehicles) e.monthlyVehicles = "Aylık araç adedi gerekli";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitRef.current) return;
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    submitRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        trackMarketingEvent("demo_submitted", { form_location: "assistant" });
        onSuccess("demo");
        return;
      }
      const body = await res.json().catch(() => null);
      if (body?.errors) setErrors(body.errors as FormErrors);
      else setErrors({ _general: body?.message ?? "Talep gönderilemedi. Lütfen tekrar deneyin." });
    } catch {
      setErrors({ _general: "Bağlantı hatası oluştu. Lütfen tekrar deneyin." });
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <ViewHeader title="Demo talebi — sizi arayalım" onBack={onBack} />

      {errors._general && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-foreground">
          {errors._general}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="da-name">Ad Soyad *</Label>
        <Input id="da-name" placeholder="Ahmet Yılmaz" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
        {errors.name && <p className="text-xs text-destructive-strong">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-business">İşletme Adı *</Label>
        <Input id="da-business" placeholder="Yılmaz Oto Servis" value={data.businessName} onChange={(e) => setData({ ...data, businessName: e.target.value })} />
        {errors.businessName && <p className="text-xs text-destructive-strong">{errors.businessName}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-phone">Telefon *</Label>
        <Input id="da-phone" type="tel" inputMode="tel" placeholder="0532 123 4567" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
        {errors.phone && <p className="text-xs text-destructive-strong">{errors.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-city">Şehir *</Label>
        <Select value={data.city} onValueChange={(value) => setData({ ...data, city: value })}>
          <SelectTrigger id="da-city" className="w-full">
            <SelectValue placeholder="Şehir seçin" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectGroup>
              {TR_CITIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {errors.city && <p className="text-xs text-destructive-strong">{errors.city}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-vehicles">Aylık ortalama araç adedi *</Label>
        <Select value={data.monthlyVehicles} onValueChange={(value) => setData({ ...data, monthlyVehicles: value })}>
          <SelectTrigger id="da-vehicles" className="w-full">
            <SelectValue placeholder="Seçin" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {MONTHLY_VEHICLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {errors.monthlyVehicles && <p className="text-xs text-destructive-strong">{errors.monthlyVehicles}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="da-notes">Not (opsiyonel)</Label>
        <Textarea id="da-notes" rows={2} placeholder="İhtiyacınızı kısaca yazın" value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gönderiliyor...
          </>
        ) : (
          "Demo Talep Et"
        )}
      </Button>
    </form>
  );
}
