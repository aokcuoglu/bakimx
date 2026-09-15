"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { demoRequestSchema } from "@/lib/validations/demo-request";
import { TR_CITIES } from "@/lib/tr-cities";
import { captureDemoAttribution, getDemoAttribution, hasDemoAdvertisingConsent, trackDemoAdvertisingConversion } from "@/lib/demo-attribution";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

type Values = z.infer<typeof demoRequestSchema>;
export function HeroLeadForm({
  formLocation = "home",
  showNotes = false,
}: {
  formLocation?: "home" | "demo_page";
  showNotes?: boolean;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: {
      name: "",
      businessName: "",
      phone: "",
      city: "",
      monthlyVehicles: "",
      notes: "",
    },
  });
  const [success, setSuccess] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef(false);
  const formStartedRef = useRef(false);
  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);
  async function onSubmit(values: Values) {
    if (submitRef.current) return;
    submitRef.current = true;
    form.clearErrors("root");
    try {
      captureDemoAttribution();
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, attribution: getDemoAttribution(), targetingConsent: hasDemoAdvertisingConsent() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errors = data.errors as Record<string, string> | undefined;
        if (errors) {
          for (const [key, message] of Object.entries(errors)) {
            form.setError(key in values ? (key as keyof Values) : "root", {
              message,
            });
          }
        } else
          form.setError("root", {
            message:
              data.message || "Form gönderilemedi. Lütfen tekrar deneyin.",
          });
        return;
      }
      const result = await response.json().catch(() => ({})) as { eventId?: string };
      trackMarketingEvent("demo_submitted", { form_location: formLocation, event_id: result.eventId });
      if (result.eventId) trackDemoAdvertisingConversion(result.eventId);
      setSuccess(true);
    } catch {
      form.setError("root", {
        message: "Bağlantı hatası oluştu. Lütfen tekrar deneyin.",
      });
    } finally {
      submitRef.current = false;
    }
  }
  if (success)
    return (
      <div
        ref={successRef}
        id="demo-form"
        tabIndex={-1}
        role="status"
        className="py-8 outline-none"
      >
        <CheckCircle2 className="mb-5 size-10 text-success-strong" />
        <h3 className="text-2xl font-semibold tracking-tight">
          Talebiniz alındı!
        </h3>
        <p className="mt-3 leading-7 text-muted-foreground">
          Sizi arayıp servisinizin ihtiyaçlarını birlikte değerlendireceğiz.
        </p>
        <Button asChild variant="navy" className="mt-6">
          <Link href="/register">Beklemeden denemeye başlayın</Link>
        </Button>
      </div>
    );
  return (
    <Form {...form}>
      <form
        id="demo-form"
        onFocus={() => {
          if (!formStartedRef.current) formStartedRef.current = trackMarketingEvent("demo_form_started", { form_location: formLocation });
        }}
        onSubmit={(event) => {
          void form.handleSubmit(onSubmit)(event);
        }}
        className="space-y-5"
        noValidate
      >
        {form.formState.errors.root && (
          <Alert variant="destructive">
            <AlertDescription>
              {form.formState.errors.root.message}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              {
                name: "name",
                label: "Ad Soyad",
                placeholder: "Ahmet Yılmaz",
                autoComplete: "name",
              },
              {
                name: "phone",
                label: "Telefon",
                placeholder: "0532 123 4567",
                autoComplete: "tel",
              },
              {
                name: "businessName",
                label: "Servis adı",
                placeholder: "Yılmaz Oto Servis",
                autoComplete: "organization",
              },
            ] as const
          ).map(({ name, label, placeholder, autoComplete }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem
                  className={name === "businessName" ? "sm:col-span-2" : ""}
                >
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete={autoComplete}
                      type={name === "phone" ? "tel" : "text"}
                      placeholder={placeholder}
                      className="h-12 rounded-xl bg-card"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          {(
            [
              {
                name: "city",
                label: "Şehir",
                placeholder: "Şehir seçin",
                options: TR_CITIES.map((city) => ({
                  value: city,
                  label: city,
                })),
              },
              {
                name: "monthlyVehicles",
                label: "Aylık araç adedi",
                placeholder: "Seçin",
                options: ["1-20", "21-50", "51-100", "100+"].map((value) => ({
                  value,
                  label: value.replace("-", " - "),
                })),
              },
            ] as const
          ).map(({ name, label, placeholder, options }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger
                        ref={field.ref}
                        onBlur={field.onBlur}
                        className="h-12 w-full rounded-xl bg-card data-[size=default]:h-12"
                      >
                        <SelectValue placeholder={placeholder} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        {showNotes && (
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Not / İhtiyaç (isteğe bağlı)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Servisinizde neyi kolaylaştırmak istersiniz?"
                    className="min-h-24 rounded-xl bg-card"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button
          variant="navy"
          size="xl"
          type="submit"
          className="h-12 w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin" /> Gönderiliyor...
            </>
          ) : (
            "Demo İste"
          )}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          Bilgileriniz yalnız sizinle iletişim için kullanılır.{" "}
          <Link href="/kvkk" className="underline underline-offset-2">
            KVKK Aydınlatma Metni
          </Link>
        </p>
      </form>
    </Form>
  );
}
