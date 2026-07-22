"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { BrandEyebrow } from "@/components/shared/brand-decor";

export function FinalCTASection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-brand/10 py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[520px] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <BrandEyebrow>Hemen başlayın</BrandEyebrow>
        </motion.div>
        <motion.h2
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
        >
          Servisinizi bugün dijitale taşıyın
        </motion.h2>
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Kurulum yok, taahhüt yok. Kart doğrulamasının ardından 7 günlük
          denemeniz anında başlar.
        </motion.p>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4"
        >
          <Link
            href="/register"
            className={buttonVariants({ size: "lg", className: "gap-2 px-8 text-base shadow-lg shadow-primary/25" })}
          >
            7 Gün Ücretsiz Dene
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/#demo-form"
            className={buttonVariants({ variant: "outline", size: "lg", className: "border-primary/25 px-8 text-base" })}
          >
            Demo İste
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
