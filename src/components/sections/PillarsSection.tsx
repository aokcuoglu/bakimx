"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ScanLine,
  Camera,
  MessageSquare,
  CheckCircle2,
  Lock,
  Car,
} from "lucide-react";
import { BrandEyebrow } from "@/components/shared/brand-decor";

export function PillarsSection() {
  const prefersReducedMotion = useReducedMotion();

  const pillars = [
    {
      title: "Saniyede araç kabul",
      description:
        "Ruhsatı telefon kamerasıyla okutun; araç, müşteri ve şasi bilgisi otomatik dolsun.",
      vignette: (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-mono text-sm font-semibold">34 ABC 123</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              <CheckCircle2 className="h-3 w-3" />
              Otomatik dolduruldu
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded bg-muted/60 px-2 py-1">Honda Civic 1.6</span>
            <span className="rounded bg-muted/60 px-2 py-1">2018 · Dizel</span>
          </div>
        </div>
      ),
    },
    {
      title: "Fotoğraflı iş emri",
      description:
        "Hasar haritası ve fotoğraf kanıtı iş emrine kilitlenir; sonradan değiştirilemez, anlaşmazlık biter.",
      vignette: (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Kabul fotoğrafları</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" />
              Değiştirilemez
            </span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex h-9 flex-1 items-center justify-center rounded bg-muted/70"
              >
                <Camera className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Müşteri hep haberdar",
      description:
        "Teklif ve servis durumu WhatsApp'tan gider; müşteri aracını canlı takip linkinden izler.",
      vignette: (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-whatsapp/10">
              <MessageSquare className="h-3.5 w-3.5 text-whatsapp" />
            </div>
            <div className="rounded-lg rounded-tl-none bg-muted/70 px-2.5 py-1.5 text-[11px] leading-snug">
              Aracınızın bakımı tamamlandı. Detaylar: bakimx.com/s/a3k…
            </div>
          </div>
          <p className="mt-2 text-right text-[10px] text-muted-foreground">
            Teklif #1042 · görüntülendi ✓
          </p>
        </div>
      ),
    },
  ];

  return (
    <section className="bg-brand/10 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <BrandEyebrow>Operasyon merkezi</BrandEyebrow>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Servisinizin dijital operasyon merkezi
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="flex flex-col gap-4 rounded-xl bg-background/60 p-5 sm:p-6"
            >
              <div className="rounded-xl bg-brand/10 p-4">{pillar.vignette}</div>
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  {i === 0 && <ScanLine className="h-5 w-5 text-primary" />}
                  {i === 1 && <Camera className="h-5 w-5 text-primary" />}
                  {i === 2 && <MessageSquare className="h-5 w-5 text-primary" />}
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
