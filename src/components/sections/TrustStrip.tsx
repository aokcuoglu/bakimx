"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Smartphone, Users, Sparkles } from "lucide-react";

const tags = [
  "Oto Tamirciler",
  "Özel Servisler",
  "Kaporta/Boya Atölyeleri",
  "Mekanik Servisler",
];

const assurances = [
  { icon: ShieldCheck, label: "KVKK uyumlu" },
  { icon: Smartphone, label: "Mobil öncelikli" },
  { icon: Users, label: "Çok kullanıcılı & yetki" },
  { icon: Sparkles, label: "Kurulum gerektirmez" },
];

export function TrustStrip() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="py-10 sm:py-14 border-b bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="text-sm sm:text-base text-muted-foreground mb-4"
        >
          Türkiye&apos;deki oto servisler için geliştiriliyor.
        </motion.p>
        <div className="flex flex-wrap justify-center gap-2">
          {tags.map((tag, i) => (
            <motion.span
              key={tag}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="inline-flex items-center rounded-full border bg-card px-4 py-1.5 text-xs sm:text-sm font-medium text-foreground shadow-sm"
            >
              {tag}
            </motion.span>
          ))}
        </div>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2"
        >
          {assurances.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-primary" />
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
