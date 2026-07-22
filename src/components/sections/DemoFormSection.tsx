"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PhoneCall, Clock, ShieldCheck } from "lucide-react";
import { HeroLeadForm } from "@/components/sections/HeroLeadForm";
import { BrandEyebrow } from "@/components/shared/brand-decor";

const points = [
  { icon: PhoneCall, title: "Sizi biz arayalım", description: "Servisinize göre kısa bir tanıtım yapalım, sorularınızı yanıtlayalım." },
  { icon: Clock, title: "Beklemeden başlayın", description: "İsterseniz aramayı beklemeden 7 günlük denemenizi hemen açabilirsiniz." },
  { icon: ShieldCheck, title: "Baskı yok", description: "Bilgileriniz yalnızca sizinle iletişim için kullanılır — KVKK uyumlu." },
];

export function DemoFormSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="scroll-mt-24 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="max-w-xl"
          >
            <BrandEyebrow>Demo</BrandEyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Servisiniz için birlikte bakalım
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Bilgilerinizi bırakın; BakimX&apos;in servisinize nasıl oturduğunu
              gösterelim. Karar tamamen sizin.
            </p>
            <ul className="mt-8 space-y-5">
              {points.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="w-full lg:max-w-md lg:justify-self-end"
          >
            <HeroLeadForm />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
