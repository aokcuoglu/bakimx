"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function EarlyAccessCTASection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="erken-uye"
      className="relative py-16 sm:py-24 bg-navy-light text-white overflow-hidden"
    >
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
          Erken üye olun, başlangıç fiyatını kilitleyin
        </motion.h2>
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 text-white/70 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
        >
          Erken üyelere özel başlangıç fiyatı · 15 gün ücretsiz · kredi kartı
          gerekmez.
        </motion.p>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex flex-col items-center gap-3"
        >
          <Link
            href="/register"
            className={buttonVariants({
              size: "lg",
              className: "bg-white !text-navy hover:!bg-white/90 text-base h-11 px-8 gap-2",
            })}
          >
            15 Gün Ücretsiz Dene
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/demo"
            className="text-sm text-white/60 hover:text-white transition-colors underline underline-offset-4"
          >
            Önce demo görmek ister misiniz? Demo talep edin
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
