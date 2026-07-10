"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

// Mutlu SVG'si beyaz dolgulu (koyu zemin için çizilmiş): açık temada brightness-0
// ile koyulaştırılır, koyu temada doğal beyaz haliyle kalır. AWS logosu beyaz
// zeminli JPEG: koyu temada beyaz chip içinde gösterilir ki kutu kasıtlı görünsün.
const partners = [
  {
    name: "Mutlu Akü",
    src: "/landing/partners/mutlu.svg",
    width: 137,
    height: 36,
    imgClass:
      "opacity-60 brightness-0 transition-all duration-300 hover:opacity-90 dark:brightness-100 dark:opacity-80 dark:hover:opacity-100",
  },
  {
    name: "AWS Startups",
    src: "/landing/partners/aws-startups.jpg",
    width: 96,
    height: 50,
    imgClass:
      "opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 dark:grayscale-0 dark:opacity-100 dark:rounded-md dark:bg-white dark:p-1",
  },
];

export function PartnersStrip() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="border-b bg-background py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Güçlü iş ortakları ve altyapıyla çalışıyoruz
        </motion.p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-14 gap-y-6">
          {partners.map((partner, i) => (
            <motion.div
              key={partner.name}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Image
                src={partner.src}
                alt={partner.name}
                width={partner.width}
                height={partner.height}
                className={partner.imgClass}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
