"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ViewHeader } from "./view-header";
import type { SuccessContext } from "../site-assistant";

interface SupportFormViewProps {
  onBack: () => void;
  onSuccess: (context: SuccessContext) => void;
}

interface FormData {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  message?: string;
  _general?: string;
}

const EMPTY: FormData = { name: "", businessName: "", email: "", phone: "", subject: "", message: "" };

export function SupportFormView({ onBack, onSuccess }: SupportFormViewProps) {
  const [data, setData] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (data.name.trim().length < 2) e.name = "Ad Soyad en az 2 karakter olmalıdır";
    if (data.businessName.trim().length < 2) e.businessName = "İşletme adı en az 2 karakter olmalıdır";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) e.email = "Geçerli bir e-posta girin";
    if (!/^[0-9+\-\s()]{7,15}$/.test(data.phone.trim())) e.phone = "Geçerli bir telefon girin";
    if (data.message.trim().length < 10) e.message = "Mesaj en az 10 karakter olmalıdır";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/support-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        onSuccess("support");
        return;
      }
      const body = await res.json().catch(() => null);
      if (body?.errors) setErrors(body.errors as FormErrors);
      else setErrors({ _general: body?.message ?? "Talep gönderilemedi. Lütfen tekrar deneyin." });
    } catch {
      setErrors({ _general: "Bağlantı hatası oluştu. Lütfen tekrar deneyin." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <ViewHeader title="Destek / İletişim" onBack={onBack} />

      {errors._general && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-foreground">
          {errors._general}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sa-name">Ad Soyad *</Label>
        <Input id="sa-name" placeholder="Ahmet Yılmaz" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-business">İşletme Adı *</Label>
        <Input id="sa-business" placeholder="Yılmaz Oto Servis" value={data.businessName} onChange={(e) => setData({ ...data, businessName: e.target.value })} />
        {errors.businessName && <p className="text-xs text-destructive">{errors.businessName}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-email">E-posta *</Label>
        <Input id="sa-email" type="email" inputMode="email" placeholder="ornek@servis.com" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-phone">Telefon *</Label>
        <Input id="sa-phone" inputMode="tel" placeholder="0532 123 4567" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-subject">Konu (opsiyonel)</Label>
        <Input id="sa-subject" placeholder="Konu başlığı" value={data.subject} onChange={(e) => setData({ ...data, subject: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sa-message">Mesajınız *</Label>
        <Textarea id="sa-message" rows={3} placeholder="Size nasıl yardımcı olabiliriz?" value={data.message} onChange={(e) => setData({ ...data, message: e.target.value })} />
        {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gönderiliyor...
          </>
        ) : (
          "Gönder"
        )}
      </Button>
    </form>
  );
}
