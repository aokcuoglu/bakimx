"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, CircleCheck } from "lucide-react";

type BillingCycle = "monthly" | "yearly";

interface Plan {
  id: string;
  name: string;
  monthlyPrice: string | null;
  yearlyPrice: string | null;
  badge: string;
  description: string;
  features: string[];
}

const plans: Plan[] = [
  {
    id: "baslangic",
    name: "Başlangıç",
    monthlyPrice: "₺499/ay",
    yearlyPrice: "₺4.790/yıl",
    badge: "Demo döneminde avantajlı",
    description: "Tek kullanıcı ve temel araç kabul akışı",
    features: [
      "Mobil araç kabul formu",
      "Temel fotoğraf checklist'i",
      "Araç ve müşteri kaydı",
      "WhatsApp ile çıktı linki",
      "Tek kullanıcı",
      "Temel destek",
    ],
  },
  {
    id: "standart",
    name: "Standart",
    monthlyPrice: "₺999/ay",
    yearlyPrice: "₺9.590/yıl",
    badge: "En popüler",
    description: "Küçük ve orta ölçekli oto servisler için",
    features: [
      "Mobil araç kabul formu",
      "2D araç hasar işaretleme",
      "Yönlendirmeli fotoğraf çekimi",
      "Ruhsat fotoğrafı ve şase teyidi altyapısı",
      "SMS onay altyapısı",
      "WhatsApp ile kurumsal çıktı paylaşımı",
      "Logo ile özelleştirilmiş çıktı",
      "Parça ve işçilik satırları",
      "Önceki işçilik fiyatlarını hatırlama altyapısı",
      "Öncelikli destek",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "₺1.999/ay",
    yearlyPrice: "₺19.190/yıl",
    badge: "Büyüyen servisler",
    description: "Çoklu kullanıcı, gelişmiş çıktı ve raporlama",
    features: [
      "Standart plandaki her şey",
      "Çoklu kullanıcı",
      "Gelişmiş servis çıktısı",
      "Gelişmiş raporlama",
      "İşçilik fiyat geçmişi",
      "Gelişmiş müşteri/araç geçmişi",
      "SMS kullanım takibi",
      "Öncelikli geliştirme talepleri",
    ],
  },
  {
    id: "kurumsal",
    name: "Kurumsal",
    monthlyPrice: null,
    yearlyPrice: null,
    badge: "Çok şube",
    description: "Çoklu lokasyon ve entegrasyon ihtiyaçları",
    features: [
      "Pro plandaki her şey",
      "Çoklu şube",
      "Özel onboarding",
      "API/entegrasyon hazırlığı",
      "Gelişmiş yetkilendirme",
      "Özel destek",
      "Kurumsal raporlama",
    ],
  },
];

export function PricingSection() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string>("standart");
  const prefersReducedMotion = useReducedMotion();

  const activePlan = plans.find((p) => p.id === selectedPlan) ?? plans[1];

  return (
    <section id="fiyatlandirma" className="py-16 sm:py-24 bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-4">
            Fiyatlandırma
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            Her oto servis için <span className="text-primary">esnek paketler</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            BakimX&apos;i işletmenizin büyüklüğüne göre konumlandırın. Demo döneminde
            özel fiyatlandırma avantajlarından yararlanın.
          </p>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex justify-center mb-10"
        >
          <div className="inline-flex rounded-lg border bg-card p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billing === "monthly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Aylık
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yıllık
              {billing === "yearly" && (
                <span className="text-[10px] font-semibold bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full">
                  %20 avantaj
                </span>
              )}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid gap-8 lg:grid-cols-2"
        >
          <div className="space-y-3">
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full text-left rounded-xl border-2 p-4 sm:p-5 transition-all duration-200 ${
                    isSelected
                      ? "border-primary bg-gradient-to-br from-[#0B1F3A] to-primary/90 text-white shadow-lg"
                      : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0 ${
                          isSelected
                            ? "border-white bg-white"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-[#0B1F3A]" strokeWidth={3} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold text-base ${isSelected ? "text-white" : "text-foreground"}`}>
                            {plan.name}
                          </span>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : plan.id === "standart"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {plan.badge}
                          </span>
                        </div>
                        <p className={`text-sm mt-0.5 ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                          {plan.description}
                        </p>
                      </div>
                    </div>
                    <div className="sm:text-right pl-8 sm:pl-0">
                      <span className={`text-lg font-bold ${isSelected ? "text-white" : "text-foreground"}`}>
                        {plan.monthlyPrice
                          ? billing === "monthly"
                            ? plan.monthlyPrice
                            : plan.yearlyPrice
                          : "Özel fiyat"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 to-sky-50 border-b px-5 py-4">
              <h3 className="font-semibold text-base text-foreground">
                Pakete dahil olanlar
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-medium text-foreground">{activePlan.name}</span> planı özellikleri
              </p>
            </div>
            <div className="px-5 py-4">
              <ul className="space-y-3">
                {activePlan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CircleCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-10 text-center space-y-4"
        >
          <a
            href="#demo-talep"
            className="inline-flex items-center justify-center h-12 px-8 rounded-lg bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-colors"
          >
            Demo Talep Et
          </a>
          <p className="text-sm text-muted-foreground">
            Satın alma yok, demo talebi alınır.
          </p>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">
              Demo sonrası paketi birlikte netleştirelim
            </span>
          </label>
        </motion.div>
      </div>
    </section>
  );
}