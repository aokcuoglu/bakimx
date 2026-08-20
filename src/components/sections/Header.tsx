"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Menu, X } from "lucide-react";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

const navItems = [
  { label: "Canlı Demo", href: "/#ruhsat-demo" },
  { label: "Özellikler", href: "/#ozellikler" },
  { label: "Neden BakimX", href: "/#neden" },
  { label: "SSS", href: "/#sss" },
  { label: "Fiyatlar", href: "/fiyatlar" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const pathname = usePathname();

  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // On the landing page, smooth-scroll to top; elsewhere let the link navigate home.
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setMobileOpen(false);
  }

  return (
    <motion.header
      initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b border-brand/10 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8 lg:justify-between relative">
        <Link
          href="/"
          onClick={handleLogoClick}
          aria-label="BakimX ana sayfa"
          className="flex items-center shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 lg:mr-4 absolute lg:static left-1/2 -translate-x-1/2 lg:translate-x-0"
        >
          <BrandLogo variant="primary-light" size="lg" priority alt="BakimX" />
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Giriş Yap
          </Link>
          <Link
            href="/register"
            onClick={() => trackMarketingEvent("trial_cta_click", { cta_location: "header_desktop" })}
            className={buttonVariants({ size: "default", className: "bg-primary text-primary-foreground hover:bg-primary/90" })}
          >
            Ücretsiz Dene
          </Link>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden ml-auto"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t bg-background">
          <div className="flex flex-col gap-1 px-4 py-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground py-2.5"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t">
              <Link
                href="/login"
                className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground py-2.5 text-center"
                onClick={() => setMobileOpen(false)}
              >
                Giriş Yap
              </Link>
              <Link
                href="/register"
                onClick={() => { setMobileOpen(false); trackMarketingEvent("trial_cta_click", { cta_location: "header_mobile" }) }}
                className={buttonVariants({ size: "lg", className: "bg-primary text-primary-foreground hover:bg-primary/90 w-full text-center" })}
              >
                Ücretsiz Dene
              </Link>
            </div>
          </div>
        </div>
      )}
    </motion.header>
  );
}
