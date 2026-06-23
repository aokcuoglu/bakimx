"use client";

import { motion, useReducedMotion } from "framer-motion";

export function AnnouncementBar() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-primary text-primary-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-center gap-2 text-center text-xs sm:text-sm">
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Erken Üye
          </span>
          <span>
            Erken üyelere özel başlangıç fiyatları · 15 gün ücretsiz deneyin, kredi kartı gerekmez.
          </span>
        </div>
      </div>
    </motion.div>
  );
}