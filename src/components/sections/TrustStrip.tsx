"use client";

import { motion, useReducedMotion } from "framer-motion";

export function TrustStrip() {
  const tags = [
    "Oto Tamirciler",
    "Özel Servisler",
    "Kaporta/Boya Atölyeleri",
    "Mekanik Servisler",
  ];
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
          BakimX; oto tamirciler, özel servisler ve küçük servis işletmeleri için tasarlanıyor.
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
      </div>
    </section>
  );
}