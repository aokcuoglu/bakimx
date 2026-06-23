"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ScanLine, Brain, Wallet, Receipt, Sparkles, Building2 } from "lucide-react";

const roadmap = [
  {
    icon: ScanLine,
    title: "OCR ruhsat okuma",
    description: "Ruhsat fotoğrafından plaka, şase ve araç bilgilerini otomatik okuma.",
  },
  {
    icon: Brain,
    title: "Fiyat hafızası",
    description: "Aynı müşteri veya araç için geçmiş fiyatları otomatik hatırlama.",
  },
  {
    icon: Wallet,
    title: "Tahsilat & kasa",
    description: "Tahsilat, kasa ve alacak yaşlandırma takibi.",
  },
  {
    icon: Receipt,
    title: "e-Fatura / e-Arşiv",
    description: "Fatura entegrasyonu ile yasal çıktılar.",
  },
  {
    icon: Sparkles,
    title: "AI servis danışmanı",
    description: "Yapay zeka destekli servis ve fiyat önerileri.",
  },
  {
    icon: Building2,
    title: "Çoklu şube",
    description: "Birden fazla şubeyi tek hesaptan yönetme.",
  },
];

export function RoadmapSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="yol-haritasi" className="py-16 sm:py-24 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Yol Haritası"
          title="Yakında geliyor"
          subtitle="Çekirdek araç kabul akışı bugün hazır. Sıradaki özellikler geliştirme yol haritamızda."
        />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
          {roadmap.map((item, i) => (
            <motion.div
              key={item.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-lg border border-dashed bg-card/50 p-4 sm:p-5"
            >
              <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Yakında
                </span>
              </div>
              <h3 className="font-semibold text-sm sm:text-base mb-1">{item.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
