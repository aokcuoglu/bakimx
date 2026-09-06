"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ArrowRight, Menu, X } from "lucide-react";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

const navItems = [
  { label: "Özellikler", href: "/#ozellikler" },
  { label: "Neden BakımX?", href: "/#neden" },
  { label: "Fiyatlar", href: "/fiyatlar" },
  { label: "Sorularınız", href: "/#sss" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobileOpen]);
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          href="/"
          aria-label="BakımX ana sayfa"
          className="flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setMobileOpen(false)}
        >
          <BrandLogo variant="primary-light" size="lg" priority alt="BakımX" />
          <span className="border-l pl-3 text-xs font-medium leading-4 text-muted-foreground">
            Servisinizin
            <br />
            yeni düzeni.
          </span>
        </Link>
        <nav
          aria-label="Ana menü"
          className="hidden items-center gap-7 lg:flex"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/login" className="text-sm font-medium text-navy">
            Giriş yap
          </Link>
          <Button asChild size="xl" className="h-10">
            <Link
              href="/register"
              onClick={() =>
                trackMarketingEvent("trial_cta_click", {
                  cta_location: "header_desktop",
                })
              }
            >
              Ücretsiz dene <ArrowRight />
            </Link>
          </Button>
        </div>
        <Button
          ref={menuButton}
          variant="outline"
          size="icon"
          className="size-10 lg:hidden"
          aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>
      {mobileOpen && (
        <nav
          id="mobile-menu"
          aria-label="Mobil menü"
          className="border-t bg-card px-5 py-5 lg:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-3 text-sm font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="px-2 py-3 text-sm font-medium"
              onClick={() => setMobileOpen(false)}
            >
              Giriş yap
            </Link>
            <Button asChild size="xl" className="mt-2 h-12">
              <Link
                href="/register"
                onClick={() => {
                  setMobileOpen(false);
                  trackMarketingEvent("trial_cta_click", {
                    cta_location: "header_mobile",
                  });
                }}
              >
                Ücretsiz dene <ArrowRight />
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
