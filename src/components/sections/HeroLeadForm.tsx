"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, ShieldCheck, Zap, CalendarCheck, ArrowRight } from "lucide-react";
import { TR_CITIES } from "@/lib/tr-cities";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

interface FormData {
  name: string;
  businessName: string;
  phone: string;
  city: string;
  monthlyVehicles: string;
}

type FormErrors = Partial<Record<keyof FormData | "_general", string>>;

/**
 * Alan hatası — `role="alert"` ile ekran okuyucuya anons edilir; Input ise
 * `aria-invalid` + `aria-describedby` ile bu paragrafa bağlanır.
 */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive-strong">
      {message}
    </p>
  );
}

const EMPTY_FORM: FormData = {
  name: "",
  businessName: "",
  phone: "",
  city: "",
  monthlyVehicles: "",
};

const trustBadges = [
  { icon: ShieldCheck, label: "KVKK uyumlu" },
  { icon: Zap, label: "Kurulumsuz" },
  { icon: CalendarCheck, label: "7 iş günü ücretsiz" },
];

export function HeroLeadForm() {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const submitRef = useRef(false);
  const successRef = useRef<HTMLDivElement>(null);

  // Form DOM'dan kalkıp başarı kartına dönüşürken odağı da taşı; aksi halde
  // odak <body>'ye düşer ve "Talebiniz alındı!" hiç duyulmaz.
  useEffect(() => {
    if (isSuccess) successRef.current?.focus();
  }, [isSuccess]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (formData.name.trim().length < 2) errs.name = "Ad Soyad en az 2 karakter olmalıdır";
    if (formData.businessName.trim().length < 2) errs.businessName = "Servis adı en az 2 karakter olmalıdır";
    if (!formData.phone.trim()) {
      errs.phone = "Telefon gerekli";
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(formData.phone.trim())) {
      errs.phone = "Telefon numarası geçersiz görünüyor";
    }
    if (!formData.city) errs.city = "Şehir seçin";
    if (!formData.monthlyVehicles) errs.monthlyVehicles = "Aylık araç adedi seçin";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitRef.current) return;
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    submitRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        trackMarketingEvent("demo_submitted", { form_location: "home" });
        setIsSuccess(true);
      } else {
        try {
          const data = await res.json();
          setErrors(
            data.errors ?? { _general: "Form gönderilemedi. Lütfen alanları kontrol edin." }
          );
        } catch {
          setErrors({ _general: "Form gönderilemedi. Lütfen alanları kontrol edin." });
        }
      }
    } catch {
      setErrors({ _general: "Bağlantı hatası oluştu. Lütfen tekrar deneyin." });
    } finally {
      submitRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div
        ref={successRef}
        id="demo-form"
        tabIndex={-1}
        role="status"
        className="rounded-xl border bg-card p-8 shadow-xl text-center scroll-mt-24 outline-none"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success-strong" />
        </div>
        <h3 className="text-xl font-bold">Talebiniz alındı!</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          En kısa sürede sizi arayacağız. Beklemeden kendiniz de başlayabilirsiniz:
        </p>
        <Link
          href="/register"
          className={buttonVariants({ size: "default", className: "mt-5 w-full gap-2" })}
        >
          Ücretsiz Dene
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div id="demo-form" className="rounded-xl border bg-card p-6 sm:p-8 shadow-xl scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        {trustBadges.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {label}
          </span>
        ))}
      </div>
      <h3 className="text-center text-xl font-bold">Hemen başlayın</h3>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Bilgilerinizi bırakın, sizi arayalım.
      </p>
      {errors._general && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm"
        >
          {errors._general}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hero-name">Ad Soyad</Label>
            <Input
              id="hero-name"
              placeholder="Ahmet Yılmaz"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "hero-name-error" : undefined}
            />
            <FieldError id="hero-name-error" message={errors.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hero-phone">Telefon</Label>
            <Input
              id="hero-phone"
              type="tel"
              inputMode="tel"
              placeholder="0532 123 4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "hero-phone-error" : undefined}
            />
            <FieldError id="hero-phone-error" message={errors.phone} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-businessName">Servis adı</Label>
          <Input
            id="hero-businessName"
            placeholder="Yılmaz Oto Servis"
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            aria-invalid={errors.businessName ? true : undefined}
            aria-describedby={errors.businessName ? "hero-businessName-error" : undefined}
          />
          <FieldError id="hero-businessName-error" message={errors.businessName} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hero-city">Şehir</Label>
            <Select
              value={formData.city}
              onValueChange={(value) => setFormData({ ...formData, city: value })}
            >
              <SelectTrigger
                id="hero-city"
                className="w-full"
                aria-invalid={errors.city ? true : undefined}
                aria-describedby={errors.city ? "hero-city-error" : undefined}
              >
                <SelectValue placeholder="Şehir seçin" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectGroup>
                  {TR_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError id="hero-city-error" message={errors.city} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hero-monthlyVehicles">Aylık araç adedi</Label>
            <Select
              value={formData.monthlyVehicles}
              onValueChange={(value) => setFormData({ ...formData, monthlyVehicles: value })}
            >
              <SelectTrigger
                id="hero-monthlyVehicles"
                className="w-full"
                aria-invalid={errors.monthlyVehicles ? true : undefined}
                aria-describedby={errors.monthlyVehicles ? "hero-monthlyVehicles-error" : undefined}
              >
                <SelectValue placeholder="Seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1-20">1 - 20</SelectItem>
                  <SelectItem value="21-50">21 - 50</SelectItem>
                  <SelectItem value="51-100">51 - 100</SelectItem>
                  <SelectItem value="100+">100+</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError id="hero-monthlyVehicles-error" message={errors.monthlyVehicles} />
          </div>
        </div>
        <Button type="submit" size="default" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gönderiliyor...
            </>
          ) : (
            "Demo İste"
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Bilgileriniz yalnız sizinle iletişim için kullanılır.{" "}
          <Link href="/kvkk" className="underline hover:text-foreground">
            KVKK Aydınlatma Metni
          </Link>
        </p>
      </form>
      <div className="mt-4 border-t pt-4 text-center">
        <Link href="/register" className="text-sm font-medium text-primary hover:underline">
          Ya da beklemeden 7 iş günü ücretsiz deneyin →
        </Link>
      </div>
    </div>
  );
}
