"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, Phone, Building2, User, MapPin, Hash, MessageSquare } from "lucide-react";
import { SectionHeading } from "@/components/shared/SectionHeading";

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

const cities = [
  "Adana", "Ankara", "Antalya", "Bursa", "Diyarbakır",
  "Erzurum", "Eskişehir", "Gaziantep", "İstanbul", "İzmir",
  "Kayseri", "Konya", "Mersin", "Sakarya", "Samsun",
  "Trabzon", "Şanlıurfa", "Van", "Diğer",
];

const benefitItems = [
  "Ücretsiz demo sürecesi",
  "Kurulum desteği",
  "Kullanıma göre plan seçimi",
  "İptal koşulu yok",
];

export function DemoRequestSection() {
  const prefersReducedMotion = useReducedMotion();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    businessName: "",
    phone: "",
    city: "",
    monthlyVehicles: "",
    notes: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = "Ad Soyad en az 2 karakter olmalıdır";
    }
    if (!formData.businessName.trim() || formData.businessName.trim().length < 2) {
      errs.businessName = "İşletme adı en az 2 karakter olmalıdır";
    }
    if (!formData.phone.trim()) {
      errs.phone = "Telefon gerekli";
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(formData.phone.trim())) {
      errs.phone = "Telefon numarası geçersiz görünüyor";
    }
    if (!formData.city) errs.city = "Şehir seçimi gerekli";
    if (!formData.monthlyVehicles) errs.monthlyVehicles = "Aylık araç adedi gerekli";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsSuccess(true);
      } else {
        try {
          const data = await res.json();
          if (data.errors) {
            const serverErrors: FormErrors = {};
            for (const [key, value] of Object.entries(data.errors)) {
              if (key === "_general") {
                serverErrors._general = value as string;
              } else {
                (serverErrors as Record<string, string>)[key] = value as string;
              }
            }
            setErrors(serverErrors);
          } else if (data.message) {
            setErrors({ _general: data.message as string });
          } else {
            setErrors({ _general: "Form gönderilemedi. Lütfen alanları kontrol edin." });
          }
        } catch {
          setErrors({ _general: "Form gönderilemedi. Lütfen alanları kontrol edin." });
        }
      }
    } catch {
      setErrors({ _general: "Bağlantı hatası oluştu. Lütfen tekrar deneyin." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <section id="demo-talep" className="py-16 sm:py-24 bg-background">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="rounded-lg border bg-card p-8 sm:p-12"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Demo talebiniz alındı!
            </h2>
            <p className="mt-3 text-muted-foreground text-base">
              En kısa sürede sizinle iletişime geçeceğiz. BakimX&apos;e
              gösterdiğiniz ilgi için teşekkür ederiz.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => {
                setIsSuccess(false);
                setFormData({
                  name: "",
                  businessName: "",
                  phone: "",
                  city: "",
                  monthlyVehicles: "",
                  notes: "",
                });
              }}
            >
              Yeni talep oluştur
            </Button>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section id="demo-talep" className="py-16 sm:py-24 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
        >
          <SectionHeading
            badge="İletişim"
            title="Demo"
            titleHighlight="Talep Et"
            subtitle="BakimX'i işletmenizde deneyin. Demo talebinizi oluşturun, sizinle iletişime geçelim."
            className="mb-10"
          />
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-5">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-3"
          >
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <div className="border-b bg-gradient-to-r from-primary/5 to-transparent px-6 py-4">
                <h3 className="font-semibold text-foreground">İletişim Bilgileri</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Bilgilerinizi girin, sizi arayalım.</p>
              </div>
              <div className="p-6">
                {errors._general && (
                  <div className="mb-5 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-foreground">
                    {errors._general}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        Ad Soyad *
                      </Label>
                      <Input
                        id="name"
                        placeholder="Ahmet Yılmaz"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessName" className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        İşletme Adı *
                      </Label>
                      <Input
                        id="businessName"
                        placeholder="Yılmaz Oto Servis"
                        value={formData.businessName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            businessName: e.target.value,
                          })
                        }
                      />
                      {errors.businessName && (
                        <p className="text-sm text-destructive">
                          {errors.businessName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        Telefon *
                      </Label>
                      <Input
                        id="phone"
                        placeholder="0532 123 4567"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                      {errors.phone && (
                        <p className="text-sm text-destructive">{errors.phone}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        Şehir *
                      </Label>
                      <Select
                        value={formData.city}
                        onValueChange={(value) =>
                          setFormData({ ...formData, city: value ?? "" })
                        }
                      >
                        <SelectTrigger id="city" className="w-full">
                          <SelectValue placeholder="Şehir seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {cities.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {errors.city && (
                        <p className="text-sm text-destructive">{errors.city}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monthlyVehicles" className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      Aylık ortalama araç kabul adedi *
                    </Label>
                    <Select
                      value={formData.monthlyVehicles}
                      onValueChange={(value) =>
                        setFormData({ ...formData, monthlyVehicles: value ?? "" })
                      }
                    >
                      <SelectTrigger id="monthlyVehicles" className="w-full">
                        <SelectValue placeholder="Aylık araç adedi seçin" />
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
                    {errors.monthlyVehicles && (
                      <p className="text-sm text-destructive">
                        {errors.monthlyVehicles}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      Not / İhtiyaç
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder="Özel isteklerinizi veya ihtiyaçlarınızı buraya yazabilirsiniz..."
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows={3}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 text-base"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      "Demo Talep Et"
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="rounded-lg bg-navy text-white p-6 sm:p-8 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold leading-tight">
                  BakimX demo sürecinde neler var?
                </h3>
                <p className="mt-3 text-white/70 text-sm leading-relaxed">
                  Demo talebinizi aldıktan sonra sizinle iletişime geçecek,
                  işletmenize özel kullanım senaryosunu birlikte
                  şekillendireceğiz.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3 rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary-foreground">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Birebir tanıtım</p>
                      <p className="text-xs text-white/60 mt-0.5">İşletmenize özel canlı demo</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary-foreground">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">İşletme analizi</p>
                      <p className="text-xs text-white/60 mt-0.5">Servisinize uygun plan önerisi</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Hızlı başlangıç</p>
                      <p className="text-xs text-white/60 mt-0.5">Kurulum desteği ile hemen başlayın</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10">
                <ul className="space-y-2.5">
                  {benefitItems.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-white/80">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}