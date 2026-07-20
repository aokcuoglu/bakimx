"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

// Renkli PNG logolar: varsayılan monochrome (grayscale + düşük opaklık), üstüne
// gelince tam renk. Koyu temada logoların koyu kısımları zeminde kaybolduğu için
// beyaz chip içinde gösterilir (chip padding'i Image yerine sarmalayıcıda: border-box
// img'de en-boy oranını bozuyordu).
const partners = [
  {
    name: "Mutlu Akü",
    src: "/landing/partners/mutlu.png",
    width: 96,
    height: 44,
    imgClass:
      "opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 dark:opacity-100 dark:grayscale-0",
    wrapClass: "dark:rounded-md dark:bg-white dark:p-1.5",
  },
  {
    name: "AWS Startups",
    src: "/landing/partners/aws-startups.png",
    width: 114,
    height: 30,
    imgClass:
      "opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 dark:opacity-100 dark:grayscale-0",
    wrapClass: "dark:rounded-md dark:bg-white dark:p-1.5",
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
              className={partner.wrapClass}
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
