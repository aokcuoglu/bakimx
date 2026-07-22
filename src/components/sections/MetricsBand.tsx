"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Zap, FileX, TrendingUp, Smartphone } from "lucide-react";

/**
 * Lacivert zemin uzerinde 4 KPI. Somut zaman/sayi metrikleri kullanilir;
 * "cok daha hizli" gibi yumusak ifadeler YALNIZ goreli ifade olarak yer alir
 * (abartili yuzde iddiasi yok). Stagger fade-in animasyonu whileInView ile.
 */
const metrics = [
  {
    icon: Zap,
    title: "Dakikada kabul",
    description:
      "Ruhsati telefon kamerasiyla okutun; arac ve musteri 60 saniyede hazir.",
  },
  {
    icon: FileX,
    title: "Sifir kagit form",
    description:
      "Is emri, fotograf, teklif, tahsilat — her sey dijital ve degistirilemez.",
  },
  {
    icon: TrendingUp,
    title: "Cok daha hizli is emri",
    description:
      "Kabulden teslimate kadar manuel adimlari ortadan kaldirir.",
  },
  {
    icon: Smartphone,
    title: "7/24 musteri takibi",
    description:
      "Her musteri kendi aracini telefonundan canli izler.",
  },
];

export function MetricsBand() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="bg-navy text-white py-14 sm:py-20" aria-label="BakimX temel metrikler">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
            Rakamlarla BakimX
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Operasyonunuz artik olculebilir
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/70 leading-relaxed">
            Manuel kabul, kagit form ve telefondan sms ile takip yerine BakimX&apos;in
            dijital is akisini kullanin.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8">
          {metrics.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : i * 0.08 }}
              className="flex flex-col items-start"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base sm:text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
