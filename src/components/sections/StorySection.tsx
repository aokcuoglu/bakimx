"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Quote } from "lucide-react";

export function StorySection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="py-16 sm:py-24 bg-[#0F172A] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-sky-500/10 border border-white/10 p-8 sm:p-12 aspect-square flex items-center justify-center max-h-[480px]">
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                <div className="rounded-xl bg-white/10 border border-white/10 p-4 text-center">
                  <p className="text-3xl font-bold text-white">3x</p>
                  <p className="text-xs text-white/70 mt-1">Daha hızlı kabul</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4 text-center">
                  <p className="text-3xl font-bold text-white">0</p>
                  <p className="text-xs text-white/70 mt-1">Kayıp bilgi</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4 text-center">
                  <p className="text-3xl font-bold text-white">%85</p>
                  <p className="text-xs text-white/70 mt-1">Müşteri onayı</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-4 text-center">
                  <p className="text-3xl font-bold text-white">24/7</p>
                  <p className="text-xs text-white/70 mt-1">Mobil erişim</p>
                </div>
              </div>
            </div>
            <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-sky-500/20 blur-3xl" />
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <p className="text-sm font-medium text-sky-400 uppercase tracking-wider mb-3">
              Neden BakimX?
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-6">
              BakimX, gerçek servis ihtiyaçlarına göre tasarlanıyor
            </h2>
            <p className="text-base text-white/70 leading-relaxed mb-8">
              Birçok atölyede araç kabul süreci hâlâ kağıt, WhatsApp mesajları ve
              notlarla yürütülüyor. Fotoğraflar kayboluyor, hasarlar
              kaydedilmiyor, müşteri ile anlaşmazlıklar yaşanıyor. BakimX bu
              süreci dijitalleştirerek hem profesyonellik hem de güven sağlar.
            </p>
            <div className="rounded-xl bg-white/5 border border-white/10 p-6">
              <Quote className="h-8 w-8 text-primary/60 mb-3" />
              <blockquote className="text-base sm:text-lg font-medium leading-relaxed mb-4">
                Aracı teslim alırken fotoğrafları ve mevcut hasarı aynı akışta
                kaydetmek işimizi çok kolaylaştırdı.
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/30 flex items-center justify-center text-sm font-bold text-white">
                  AY
                </div>
                <div>
                  <p className="text-sm font-medium">Servis Sahibi</p>
                  <p className="text-xs text-white/50">Demo Kullanıcı Görüşü</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}