"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

const partners = [
  {
    name: "Mutlu Akü",
    src: "/landing/partners/mutlu.svg",
    width: 137,
    height: 36,
  },
  {
    name: "AWS Startups",
    src: "/landing/partners/aws-startups.jpg",
    width: 96,
    height: 50,
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
                className="opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 dark:mix-blend-screen dark:invert-0"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
