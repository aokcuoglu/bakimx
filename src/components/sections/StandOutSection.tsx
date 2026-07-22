"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ScanLine,
  Puzzle,
  Lock,
  Link2,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { BrandEyebrow } from "@/components/shared/brand-decor";

const differentiators = [
  {
    icon: ScanLine,
    title: "Ruhsatla saniyede kabul",
    description:
      "Ruhsat fotoğrafından araç, müşteri ve şasi bilgisi yapay zekayla otomatik dolar; elle veri girişi biter.",
  },
  {
    icon: Puzzle,
    title: "Araca uygun parça kataloğu",
    description:
      "Şasi numarası araç modeliyle eşleşir; iş emrine yalnız o araca uyan parçaları eklersiniz.",
  },
  {
    icon: Lock,
    title: "Değiştirilemez fotoğraf kanıtı",
    description:
      "Kabul fotoğrafları ve hasar haritası kilitlenir; 'bu çizik bende yoktu' tartışması kayıtla kapanır.",
  },
  {
    icon: Link2,
    title: "Müşteriye canlı takip linki",
    description:
      "Müşteri aracının durumunu kendi telefonundan izler; teklif ve çıktılar WhatsApp'tan gider.",
  },
  {
    icon: Smartphone,
    title: "Mobil öncelikli, kurulumsuz",
    description:
      "Masaüstü programı kurulumu yok; telefon, tablet veya bilgisayardan aynı gün çalışmaya başlarsınız.",
  },
  {
    icon: Sparkles,
    title: "AI servis danışmanı",
    description:
      "Premium'da yapay zeka danışmanı araç geçmişine göre işlem önerir, sorularınızı yanıtlar.",
  },
];

export function StandOutSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="neden" className="scroll-mt-24 bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <BrandEyebrow>Neden BakimX</BrandEyebrow>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Bizi diğer programlardan ayıran ne?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Klasik servis programları kayıt tutar. BakimX, işin sahada nasıl
            aktığını bilir: kamerayla kabul, kanıtla teslim, müşteriyle şeffaf
            iletişim.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {differentiators.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              className="flex flex-col items-start rounded-xl border bg-card p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
