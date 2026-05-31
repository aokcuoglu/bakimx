"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

const footerLinks = {
  product: [
    { label: "Özellikler", href: "#ozellikler" },
    { label: "Fiyatlandırma", href: "#fiyatlandirma" },
    { label: "Nasıl Çalışır", href: "#cozumler" },
    { label: "SSS", href: "#sss" },
  ],
  company: [
    { label: "İletişim", href: "#" },
  ],
  legal: [
    { label: "Gizlilik Politikası", href: "/privacy" },
    { label: "Kullanım Koşulları", href: "/terms" },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();
  const prefersReducedMotion = useReducedMotion();

  return (
    <footer className="border-t bg-[#0B1F3A] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5 }}
            className="sm:col-span-2 lg:col-span-1"
          >
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Image src="/logo.svg" alt="BakimX" width={32} height={32} />
              <span className="text-xl font-bold tracking-tight">
                <span className="text-white">Bakim</span><span className="text-sky-400">X</span>
              </span>
            </Link>
            <p className="text-sm text-white/70 leading-relaxed max-w-xs">
              Oto servisler için dijital araç kabul ve müşteri onay platformu.
            </p>
            <p className="mt-3 text-xs text-white/50">
              Türkiye&apos;deki oto servisler için geliştiriliyor.
            </p>
          </motion.div>

          {[
            { title: "Ürün", links: footerLinks.product },
            { title: "Şirket", links: footerLinks.company },
            { title: "Yasal", links: footerLinks.legal },
          ].map((group, i) => (
            <motion.div
              key={group.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: (i + 1) * 0.08 }}
            >
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-white/90">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-white/60 hover:text-white transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-white/50">
              &copy; {currentYear} BakimX. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}