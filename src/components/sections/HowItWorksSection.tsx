"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { MousePointerClick, Camera, MessageSquare } from "lucide-react";
import { CarDamageIllustration } from "@/components/sections/car-damage-illustration";

const steps = [
  {
    icon: MousePointerClick,
    title: "Hasarı 2D haritada işaretle",
    description:
      "Aracın 2D şeması üzerinde mevcut hasarları tek dokunuşla işaretleyin; her hasarın türü ve konumu kayıt altına girsin.",
  },
  {
    icon: Camera,
    title: "Fotoğraf ve bilgileri kaydet",
    description:
      "Yönlendirmeli fotoğraf checklist'i ile aracı eksiksiz belgeleyin; plaka, km ve müşteri bilgisi tek ekranda.",
  },
  {
    icon: MessageSquare,
    title: "Onayı al, çıktıyı paylaş",
    description:
      "Müşteriye SMS / link ile onay gönderin; parça ve işçilik satırlarıyla profesyonel tutanağı WhatsApp veya PDF olarak iletin.",
  },
];

export function HowItWorksSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="nasil-calisir" className="py-16 sm:py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Nasıl Çalışır"
          title="Aracı teslim alın, üç adımda"
          titleHighlight="işlemi tamamlayın"
          subtitle="Sahada çalışan ekibiniz için tasarlandı: hasar haritası, fotoğraf checklist'i ve müşteri onayı tek akışta."
        />
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
          <ol className="flex flex-col gap-6">
            {steps.map((step, i) => (
              <motion.li
                key={step.title}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />
                  )}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <step.icon className="h-5 w-5 text-primary shrink-0" />
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
          >
            <DamageMapPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function DamageMapPreview() {
  return (
    <div className="rounded-lg border bg-card shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
        <MousePointerClick className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">2D Hasar Haritası</h3>
        <span className="ml-auto text-xs text-muted-foreground">3 hasar işaretli</span>
      </div>
      <div className="p-6">
        <div className="flex justify-center rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-8">
          <CarDamageIllustration className="h-52 w-auto" />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {[
            { c: "bg-destructive", l: "Ağır" },
            { c: "bg-warning", l: "Orta" },
            { c: "bg-brand", l: "Hafif" },
          ].map((it) => (
            <div key={it.l} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-full ${it.c}`} />
              {it.l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
