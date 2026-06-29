"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Smartphone,
  FileText,
  Boxes,
  Wallet,
  MessageSquare,
  ShieldCheck,
  X,
  CheckCircle2,
  ArrowDown,
} from "lucide-react";

const beforeItems = [
  "Kağıt formlar ve dağınık notlar",
  "WhatsApp'ta kaybolan fotoğraflar",
  "Excel'de elle takip",
  "Müşteriyle anlaşmazlık",
];

const afterItems = [
  "Tek panelde dijital iş emri",
  "Fotoğraf ve hasar kayıt altında",
  "Otomatik teklif ve tahsilat",
  "Kayıtlı müşteri onayı",
];

const liveFeatures = [
  { icon: Smartphone, label: "Mobil araç kabul" },
  { icon: FileText, label: "İş emri & teklif" },
  { icon: Boxes, label: "Stok & parça takibi" },
  { icon: Wallet, label: "Kasa & tahsilat" },
  { icon: MessageSquare, label: "WhatsApp / yazdırılabilir çıktı" },
  { icon: ShieldCheck, label: "Müşteri onayı & teslimat" },
];

export function WhyBakimxSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="neden" className="py-16 sm:py-24 bg-navy-light text-white overflow-x-clip">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-white/10 p-6 sm:p-8">
              <div className="rounded-lg bg-white/5 border border-white/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
                  Önce
                </p>
                <ul className="space-y-2.5">
                  {beforeItems.map((it) => (
                    <li key={it} className="flex items-center gap-2.5 text-sm text-white/60">
                      <X className="h-4 w-4 shrink-0 text-white/40" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center py-3" aria-hidden="true">
                <ArrowDown className="h-5 w-5 text-primary" />
              </div>
              <div className="rounded-lg bg-white/10 border border-primary/30 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                  Sonra
                </p>
                <ul className="space-y-2.5">
                  {afterItems.map((it) => (
                    <li key={it} className="flex items-center gap-2.5 text-sm text-white/90">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">
              Neden BakimX?
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-6">
              Gerçek servis ihtiyaçlarına göre, Türkiye için geliştiriliyor
            </h2>
            <p className="text-base text-white/70 leading-relaxed mb-8">
              Birçok atölyede iş hâlâ kağıt, WhatsApp mesajları ve Excel&apos;le
              yürütülüyor. Fotoğraflar kayboluyor, teklifler dağınık kalıyor,
              tahsilat takip edilemiyor. BakimX tüm bu süreci tek panelde
              toplayarak hem profesyonellik hem de güven sağlar.
            </p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-6">
              <p className="text-sm font-medium text-white/90 mb-4">Bugün kullanıma hazır</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {liveFeatures.map((f) => {
                  const Icon = f.icon;
                  return (
                    <li key={f.label} className="flex items-center gap-2.5 text-sm">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-white/90">{f.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-white/60">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              Her servis yalnızca kendi verisini görür — KVKK uyumlu, rol bazlı erişim.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
