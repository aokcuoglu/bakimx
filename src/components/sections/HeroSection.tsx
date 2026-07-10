"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ScanLine } from "lucide-react";
import { HeroLeadForm } from "@/components/sections/HeroLeadForm";

const valueItems = [
  "Ruhsatı okutun, araç ve müşteri saniyede kaydolsun",
  "İş emri, fotoğraf kanıtı, teklif ve tahsilat tek ekranda",
  "Müşteriniz aracını canlı takip linkinden izlesin",
];

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-card px-2 shadow-sm box-decoration-clone">
      {children}
    </span>
  );
}

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-brand/10 pt-10 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="flex max-w-xl flex-col gap-6 lg:pt-6">
            <motion.h1
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl font-bold leading-snug tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.25]"
            >
              Aracı <Highlight>saniyede</Highlight> kabul edin, servisi{" "}
              <Highlight>kağıtsız</Highlight> yönetin
            </motion.h1>
            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-base leading-relaxed text-foreground/80 sm:text-lg"
            >
              BakimX, oto servisinizin tüm operasyonunu tek panelde toplar: araç
              kabulden iş emrine, fotoğraflı kanıttan teklife ve tahsilata.
              Ruhsatı okutun, gerisini sistem doldursun.
            </motion.p>
            <motion.ul
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="space-y-2.5"
            >
              {valueItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </motion.ul>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.55 }}
            >
              <a
                href="#ruhsat-demo"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <ScanLine className="h-4 w-4" />
                Ruhsat okumayı canlı deneyin
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full lg:max-w-md lg:justify-self-end"
          >
            <HeroLeadForm />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
