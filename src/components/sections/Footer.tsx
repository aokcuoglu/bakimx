"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BrandLogo } from "@/components/shared/brand-logo";

// lucide-react no longer ships brand/social glyphs, so we inline the official marks.
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const socialLinks = [
  { label: "BakimX LinkedIn sayfası", href: "https://www.linkedin.com/company/bakimx/", icon: LinkedinIcon },
  { label: "BakimX Instagram sayfası", href: "https://www.instagram.com/bakimxcom", icon: InstagramIcon },
];

const footerLinks = {
  product: [
    { label: "Modüller", href: "/#moduller" },
    { label: "Özellikler", href: "/#ozellikler" },
    { label: "Nasıl Çalışır", href: "/#nasil-calisir" },
    { label: "Neden BakimX", href: "/#neden" },
    { label: "SSS", href: "/#sss" },
    { label: "Fiyatlar", href: "/fiyatlar" },
  ],
  company: [
    { label: "Demo Talep Et", href: "/demo" },
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
    <footer className="border-t bg-navy text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-9 lg:py-10">
        <div className="grid gap-8 sm:gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5 }}
            className="sm:col-span-2 lg:col-span-1"
          >
            <Link
              href="/"
              aria-label="BakimX ana sayfa"
              className="inline-flex items-center mb-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            >
              <BrandLogo variant="primary-dark" size="lg" alt="BakimX" />
            </Link>
            <p className="text-sm text-white/70 leading-relaxed max-w-xs">
              Oto servisler için eksiksiz servis yönetim platformu.
            </p>
            <p className="mt-3 text-xs text-white/50">
              Türkiye&apos;deki oto servisler için geliştiriliyor.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
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
              <h3 className="font-semibold mb-2.5 text-xs sm:text-sm uppercase tracking-wider text-white/90">{group.title}</h3>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:block sm:space-y-2">
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

        <div className="mt-6 pt-4 sm:mt-8 sm:pt-5 border-t border-white/10">
          <div className="flex flex-row flex-wrap justify-between items-center gap-x-4 gap-y-1">
            <p className="text-xs sm:text-sm text-white/50">
              &copy; {currentYear} BakimX. Tüm hakları saklıdır.
            </p>
            <span className="text-xs text-white/30">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}