"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const navItems = [
  { label: "Çözümler", href: "#cozumler" },
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Fiyatlandırma", href: "#fiyatlandirma" },
  { label: "SSS", href: "#sss" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileOpen(false);
  }

  return (
    <motion.header
      initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#" onClick={handleLogoClick} className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="BakimX"
            width={32}
            height={32}
            priority
          />
          <span className="text-xl font-bold tracking-tight">
            <span className="text-foreground">Bakim</span><span className="text-primary">X</span>
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-8">
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
          <a
            href="#demo-talep"
            className={buttonVariants({ size: "default", className: "bg-primary text-primary-foreground hover:bg-primary/90" })}
          >
            Demo Talep Et
          </a>
        </div>

        <button
          className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
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
              <a
                href="#demo-talep"
                onClick={() => setMobileOpen(false)}
                className={buttonVariants({ size: "lg", className: "bg-primary text-primary-foreground hover:bg-primary/90 w-full text-center" })}
              >
                Demo Talep Et
              </a>
            </div>
          </div>
        </div>
      )}
    </motion.header>
  );
}