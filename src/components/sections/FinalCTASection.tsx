"use client";

import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";

export function FinalCTASection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative py-16 sm:py-24 bg-navy-light text-white overflow-hidden">
      <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight max-w-3xl mx-auto"
        >
          BakimX ile servis kabul sürecinizi daha profesyonel hale getirin
        </motion.h2>
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 text-white/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
        >
          Demo talebinizi bırakın, size uygun kullanım senaryosunu birlikte
          şekillendirelim.
        </motion.p>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <a
            href="#demo-talep"
            className={buttonVariants({
              size: "lg",
              className: "bg-white !text-navy hover:!bg-white/90 text-base h-10 px-8",
            })}
          >
            Demo Talep Et
          </a>
          <a
            href="#sss"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "border-white/30 !bg-transparent !text-white hover:!bg-white/10 text-base h-10 px-8",
            })}
          >
            İletişime Geç
          </a>
        </motion.div>
      </div>
    </section>
  );
}