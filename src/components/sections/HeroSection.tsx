"use client";

import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import {
  Car,
  Camera,
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  Smartphone,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";

const heroBullets = [
  { icon: Smartphone, label: "Mobil araç kabul" },
  { icon: ClipboardCheck, label: "Hasar işaretleme" },
  { icon: Camera, label: "Fotoğraf checklist'i" },
  { icon: ShieldCheck, label: "Müşteri onayı" },
  { icon: MessageSquare, label: "WhatsApp işlem çıktısı" },
];

const trustItems = [
  "Mobil uyumlu",
  "Küçük ve orta ölçekli servisler için",
  "Kurumsal görünüm, kolay kullanım",
];

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-muted/30 pt-8 pb-16 sm:pt-16 sm:pb-24 lg:pt-24 lg:pb-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="flex flex-col gap-6 sm:gap-8 max-w-xl">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary w-fit"
            >
              <Smartphone className="h-4 w-4" />
              Mobil öncelikli platform
            </motion.div>
            <motion.h1
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
            >
              Oto servisinizde araç kabul sürecini{" "}
              <span className="text-primary">dijitalleştirin.</span>
            </motion.h1>
            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-base sm:text-lg text-muted-foreground leading-relaxed"
            >
              BakimX ile aracı telefondan teslim alın, mevcut hasarları
              işaretleyin, ruhsat ve araç fotoğraflarını kaydedin,
              müşteriden onay alın ve işlem çıktısını profesyonel şekilde
              paylaşın.
            </motion.p>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="flex flex-wrap gap-x-4 gap-y-1.5"
            >
              {heroBullets.map((b) => (
                <div key={b.label} className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                  <b.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{b.label}</span>
                </div>
              ))}
            </motion.div>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2"
            >
              <a
                href="#demo-talep"
                className={buttonVariants({ size: "lg", className: "bg-primary text-primary-foreground hover:bg-primary/90 text-base h-12 px-8 gap-2" })}
              >
                Demo Talep Et
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#cozumler"
                className={buttonVariants({ variant: "outline", size: "lg", className: "text-base h-12 px-8" })}
              >
                Nasıl Çalıştığını Gör
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
            <HeroComposition />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HeroComposition() {
  return (
    <div className="relative w-full max-w-md">
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-3">
          <div className="flex items-center gap-2 text-primary-foreground">
            <Car className="h-5 w-5" />
            <h3 className="font-semibold text-sm">Araç Kabul Formu</h3>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plaka</p>
              <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm font-mono font-medium">34 ABC 123</div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kilometre</p>
              <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm font-medium">87.500 km</div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Müşteri</p>
            <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm font-medium">Ahmet Yılmaz</div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hasar İşaretleme</p>
            <div className="relative rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
              <Car className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              <div className="absolute top-4 left-6 h-3 w-3 rounded-full bg-red-500 ring-2 ring-red-300 animate-pulse" />
              <div className="absolute bottom-5 right-8 h-3 w-3 rounded-full bg-sky-500 ring-2 ring-sky-300 animate-pulse" />
              <p className="text-xs text-muted-foreground mt-2 text-center">2 hasar işaretli</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-sky-900">Onay bekleniyor — SMS gönderildi</span>
          </div>
        </div>
      </div>

      <FloatingCard
        className="absolute -top-3 -right-3"
        icon={<Camera className="h-4 w-4 text-primary" />}
        title="Fotoğraf Checklist"
        subtitle="6/6 tamamlandı"
        delay={0.6}
      />

      <FloatingCard
        className="absolute -bottom-2 -left-3"
        icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
        title="WhatsApp Çıktı"
        subtitle="Müşteriye gönderildi"
        delay={0.75}
      />

      <FloatingCard
        className="absolute top-1/2 -right-6 hidden lg:block"
        icon={<ClipboardCheck className="h-4 w-4 text-primary-foreground" />}
        iconBg="bg-primary"
        title="İşçilik Ekle"
        subtitle="Parça + işçilik"
        delay={0.9}
      />
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
      className={`${className} bg-card border rounded-xl shadow-lg p-2.5 flex items-center gap-2`}
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