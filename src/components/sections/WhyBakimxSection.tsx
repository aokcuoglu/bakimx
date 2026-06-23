"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Smartphone,
  MousePointerClick,
  Camera,
  ShieldCheck,
  MessageSquare,
  ClipboardList,
} from "lucide-react";

const stats = [
  { value: "3x", label: "Daha hızlı kabul" },
  { value: "0", label: "Kayıp bilgi" },
  { value: "%85", label: "Müşteri onayı" },
  { value: "24/7", label: "Mobil erişim" },
];

const liveFeatures = [
  { icon: Smartphone, label: "Mobil araç kabul" },
  { icon: MousePointerClick, label: "2D hasar haritası" },
  { icon: Camera, label: "Fotoğraf checklist'i" },
  { icon: ShieldCheck, label: "Müşteri onayı — SMS / link" },
  { icon: MessageSquare, label: "WhatsApp / PDF çıktısı" },
  { icon: ClipboardList, label: "Parça + işçilik, iş emri" },
];

export function WhyBakimxSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="neden" className="py-16 sm:py-24 bg-navy-light text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-white/10 p-8 sm:p-12 aspect-square flex items-center justify-center max-h-[480px]">
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg bg-white/10 border border-white/10 p-4 text-center"
                  >
                    <p className="text-3xl font-bold text-white">{s.value}</p>
                    <p className="text-xs text-white/70 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
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
              Gerçek servis ihtiyaçlarına göre tasarlanıyor
            </h2>
            <p className="text-base text-white/70 leading-relaxed mb-8">
              Birçok atölyede araç kabul süreci hâlâ kağıt, WhatsApp mesajları ve
              notlarla yürütülüyor. Fotoğraflar kayboluyor, hasarlar
              kaydedilmiyor, müşteri ile anlaşmazlıklar yaşanıyor. BakimX bu
              süreci dijitalleştirerek hem profesyonellik hem de güven sağlar.
            </p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-6">
              <p className="text-sm font-medium text-white/90 mb-4">
                Bugün kullanıma hazır
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {liveFeatures.map((f) => (
                  <li key={f.label} className="flex items-center gap-2.5 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <f.icon className="h-4 w-4" />
                    </span>
                    <span className="text-white/90">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
