"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ArrowRight, Menu, X } from "lucide-react";
import { trackMarketingEvent } from "@/lib/marketing-analytics";
import { scrollToPageTop } from "@/lib/scroll-to-page-top";

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
    <header className="sticky top-0 z-50 bg-card/95 font-sans text-foreground backdrop-blur-lg">
      <div className="relative mx-auto flex h-[62px] max-w-[1124px] items-center justify-between gap-6 px-5 lg:h-[78px] lg:px-6">
        <Link
          href="/"
          aria-label="BakımX ana sayfa"
          className="flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setMobileOpen(false)}
          onNavigate={(event) => {
            if (window.location.pathname !== "/") return;

            event.preventDefault();
            window.history.replaceState(window.history.state, "", "/");
            scrollToPageTop();
          }}
        >
          <BrandLogo variant="primary-light" size="lg" priority alt="" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Bakım<span className="text-primary">X</span>
          </span>
        </Link>
        <nav
          aria-label="Ana menü"
          className="hidden items-center gap-6 lg:flex xl:absolute xl:left-1/2 xl:-translate-x-1/2"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[15px] leading-[1.5] font-normal text-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="/login"
            className="rounded-md px-1 py-1 text-[15px] leading-[1.5] font-normal text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            Giriş yap
          </Link>
          <Button asChild variant="navy" size="sm">
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
          <div className="mx-auto flex max-w-[1124px] flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-3 text-sm font-medium text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-md px-2 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              onClick={() => setMobileOpen(false)}
            >
              Giriş yap
            </Link>
            <Button asChild variant="navy" size="xl" className="mt-2">
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
