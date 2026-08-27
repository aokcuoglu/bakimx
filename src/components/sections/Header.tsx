"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
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

const SCROLL_THRESHOLD = 40;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isLanding = pathname === "/";

  useEffect(() => {
    if (!isLanding) return;

    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLanding]);

  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (isLanding) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setMobileOpen(false);
  }

  const transparent = isLanding && !scrolled;

  return (
    <header
      style={{ "--enter-from": "-0.75rem", "--enter-duration": "0.35s" } as CSSProperties}
      className={`enter-up sticky top-0 z-50 w-full transition-colors duration-300 ${
        transparent
          ? "border-b-0 bg-navy/80 backdrop-blur-md"
          : "border-b border-border bg-background shadow-sm"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8 lg:justify-between relative">
        <Link
          href="/"
          onClick={handleLogoClick}
          aria-label="BakimX ana sayfa"
          className="flex items-center shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 lg:mr-4 absolute lg:static left-1/2 -translate-x-1/2 lg:translate-x-0"
        >
          <BrandLogo variant={transparent ? "primary-dark" : "primary-light"} size="lg" priority alt="BakimX" />
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                transparent
                  ? "text-white hover:text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/login"
            className={`text-sm font-medium transition-colors ${
              transparent
                  ? "text-white hover:text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Giriş Yap
          </Link>
          <Button asChild variant={transparent ? "inverse" : "default"}>
            <Link
              href="/register"
              onClick={() => trackMarketingEvent("trial_cta_click", { cta_location: "header_desktop" })}
            >
              Ücretsiz Dene
            </Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={`lg:hidden ml-auto ${transparent ? "text-white hover:text-white hover:bg-white/10" : ""}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {mobileOpen && (
        <div id="mobile-menu" className="lg:hidden border-t bg-background">
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
              <Button asChild size="lg" className="w-full">
                <Link
                  href="/register"
                  onClick={() => { setMobileOpen(false); trackMarketingEvent("trial_cta_click", { cta_location: "header_mobile" }) }}
                >
                  Ücretsiz Dene
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
