"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import {
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  ScanLine,
  Car,
  Sparkles,
} from "lucide-react";

const trustItems = [
  "Kurulum gerektirmez",
  "15 gün ücretsiz",
  "Kredi kartı gerekmez",
];

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-muted/30 pt-8 pb-16 sm:pt-16 sm:pb-24 lg:pt-24 lg:pb-32">
      {/* Dekoratif marka gradient şekilleri */}
      <div aria-hidden="true" className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-brand/5 via-brand/10 to-transparent blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-navy/5 via-navy/10 to-transparent blur-3xl pointer-events-none" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="flex flex-col gap-6 sm:gap-8 max-w-xl">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-foreground w-fit"
            >
              <ScanLine className="h-4 w-4" />
              Ruhsatı okut, saniyede kabul et
            </motion.div>
            <motion.h1
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
            >
              Ruhsatı okut, araç{" "}
              <span className="text-primary">saniyede</span> sisteme girsin.
            </motion.h1>
            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-base sm:text-lg text-muted-foreground leading-relaxed"
            >
              Plakayı ve ruhsatı okut; araç ve müşteri otomatik dolsun, VIN&apos;iyle eşleşen
              uygun parçaları gör. Sonra iş emri, teklif, randevu ve tahsilat — hepsi tek ekranda.
            </motion.p>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="flex flex-col gap-2 pt-2"
            >
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link
                  href="/register"
                  className={buttonVariants({ size: "lg", className: "bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 gap-2 shadow-lg shadow-primary/25" })}
                >
                  15 Gün Ücretsiz Dene
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/demo"
                  className={buttonVariants({ variant: "outline", size: "lg", className: "text-base px-8 border-primary/30" })}
                >
                  Demo İste
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Başvurunuz onaylandığında 15 günlük deneme başlar.
              </p>
              <a
                href="#ruhsat-demo"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ScanLine className="h-4 w-4" />
                Ruhsat okumayı canlı deneyin
              </a>
            </motion.div>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="flex flex-wrap gap-x-6 gap-y-2 pt-2"
            >
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex justify-center lg:justify-end"
          >
            <HeroScanMock />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroScanMock() {
  return (
    <div className="relative w-full max-w-md">
      <div className="rounded-lg border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 bg-gradient-to-r from-brand to-brand/80 px-5 py-3 text-primary-foreground">
          <ScanLine className="h-5 w-5" />
          <h3 className="font-semibold text-sm">Ruhsat Okundu</h3>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
            <CheckCircle2 className="size-3" />
            Otomatik dolduruldu
          </span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
            <Car className="size-4 text-primary shrink-0" />
            <span className="font-mono text-sm font-semibold">34 ABC 123</span>
            <span className="ml-auto text-xs text-muted-foreground">HONDA CIVIC</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ScanField label="Marka / Model" value="Honda Civic 1.6" />
            <ScanField label="Model yılı" value="2018" />
            <ScanField label="Yakıt" value="Dizel" />
            <ScanField label="Şasi (VIN)" value="SHHFK2…234" mono />
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary">
            <Sparkles className="size-4 shrink-0" />
            VIN eşleşti · araca uygun parçalar hazır
          </div>
        </div>
      </div>

      <FloatingCard
        className="absolute -top-3 -right-3"
        icon={<CheckCircle2 className="h-4 w-4 text-success" />}
        iconBg="bg-success/10"
        title="Araç kabul edildi"
        subtitle="Müşteri + araç kaydı"
        delay={0.6}
      />

      <FloatingCard
        className="absolute -bottom-2 -left-3"
        icon={<MessageSquare className="h-4 w-4 text-whatsapp" />}
        iconBg="bg-whatsapp/10"
        title="WhatsApp'a gönderildi"
        subtitle="Teklif #1042"
        delay={0.75}
      />
    </div>
  );
}

function ScanField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/50 px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function FloatingCard({
  className,
  icon,
  iconBg = "bg-primary/10",
  title,
  subtitle,
  delay = 0.6,
}: {
  className: string;
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  subtitle: string;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, -4, 0] }}
      transition={
        prefersReducedMotion
          ? { duration: 0.3 }
          : { y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay }, opacity: { duration: 0.3, delay } }
      }
      className={`${className} bg-card border rounded-lg shadow-lg p-2.5 flex items-center gap-2`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold">{title}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
    </motion.div>
  );
}
