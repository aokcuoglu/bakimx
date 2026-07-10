"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";

const beforeItems = [
  "Kağıt formlar ve dağınık notlar",
  "WhatsApp'ta kaybolan fotoğraflar",
  "Excel'de elle takip",
  "Müşteriyle 'bu çizik var mıydı?' tartışması",
];

const afterItems = [
  "Tek panelde dijital iş emri",
  "Fotoğraf ve hasar kayıt altında, değiştirilemez",
  "Teklif, onay ve tahsilat otomatik akışta",
  "Kayıtlı müşteri onayı ve canlı takip linki",
];

export function BeforeAfterSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="bg-muted/30 py-16 sm:py-24 overflow-x-clip">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          Defterden panele geçin
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">
          Servislerin her gün yaşadığı dağınıklığın BakimX&apos;teki karşılığı:
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="rounded-xl border bg-card p-6 sm:p-8"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Eski yöntem
            </h3>
            <ul className="mt-5 space-y-3.5">
              {beforeItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base text-muted-foreground">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive/60" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-xl border-2 border-primary/30 bg-card p-6 sm:p-8 shadow-lg shadow-primary/5"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              BakimX ile
            </h3>
            <ul className="mt-5 space-y-3.5">
              {afterItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
