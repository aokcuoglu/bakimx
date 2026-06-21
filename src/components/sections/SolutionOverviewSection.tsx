"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ClipboardCheck, MousePointerClick, Share2 } from "lucide-react";

const solutions = [
  {
    icon: ClipboardCheck,
    title: "Araç Kabul Yönetimi",
    description: "Müşteri bilgisi, plaka, kilometre ve araç detaylarını tek ekranda hızlıca kaydedin.",
    stats: [{ label: "Ort. kabul süresi", value: "< 3 dk" }],
    features: ["Müşteri bilgisi", "Plaka & km kaydı", "Hızlı form girişi", "Araç detayları"],
  },
  {
    icon: MousePointerClick,
    title: "Hasar ve Fotoğraf Kaydı",
    description: "2D araç şablonu üzerinde hasarları işaretleyin, yönlendirmeli fotoğraf çekimi ile eksiksiz belgeleme yapın.",
    stats: [{ label: "Hasar kayıt doğruluğu", value: "%100" }],
    features: ["2D araç hasar işaretleme", "Yönlendirmeli fotoğraf çekimi", "Ruhsat ve araç görsel kaydı", "Hasar raporu oluşturma"],
  },
  {
    icon: Share2,
    title: "İş Emri ve Teslim Çıktısı",
    description: "Parça ve işçilik satırlarını düzenleyin, müşteri onay sürecini yönetin, profesyonel çıktıyı WhatsApp ile paylaşın.",
    stats: [{ label: "Müşteri onay oranı", value: "↑ %85" }],
    features: ["Parça ve işçilik satırları", "Müşteri onay süreci", "WhatsApp ile paylaşım", "Profesyonel işlem çıktısı"],
  },
];

export function SolutionOverviewSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="cozumler" className="py-16 sm:py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Çözümler"
          title="Tek platformda servis kabul ve müşteri süreci"
          subtitle="Oto servisinizde araç kabulden teslim çıktısına kadar tüm kritik adımları tek akışta yönetin."
        />
        <div className="mt-12 grid gap-6 sm:gap-8 lg:grid-cols-3">
          {solutions.map((solution, i) => (
            <motion.div
              key={solution.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
              className="group rounded-lg border bg-card p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-5">
                <solution.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{solution.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {solution.description}
              </p>
              {solution.stats.map((stat) => (
                <div key={stat.label} className="rounded-lg bg-muted/50 border px-4 py-3 mb-5">
                  <p className="text-lg font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
              <ul className="space-y-2">
                {solution.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#ozellikler"
                className="inline-flex items-center gap-1 mt-5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Daha fazlasını keşfet
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}