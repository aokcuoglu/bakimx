"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  Smartphone,
  MousePointerClick,
  FileText,
  ClipboardList,
  Brain,
  MessageSquare,
} from "lucide-react";

const features = [
  {
    icon: Smartphone,
    title: "Mobil araç kabul akışı",
    description: "Telefonunuzdan hızlıca araç kabul formu doldurun. Plaka, km, müşteri bilgilerini tek ekranda girin.",
    tag: null,
  },
  {
    icon: MousePointerClick,
    title: "2D hasar işaretleme",
    description: "Araç şablonu üzerinde hasar noktalarını işaretleyin. Her hasarın türünü ve konumunu kaydedin.",
    tag: null,
  },
  {
    icon: FileText,
    title: "Ruhsat ve şase teyidi altyapısı",
    description: "Ruhsat fotoğrafı yükleme ve şase numarası doğrulama altyapısı.",
    tag: "Yakında",
  },
  {
    icon: ClipboardList,
    title: "Parça ve işçilik satırları",
    description: "İşçilik ve parça kalemlerini düzenleyin, toplam tutarı otomatik hesaplayın.",
    tag: null,
  },
  {
    icon: Brain,
    title: "Fiyat hafızası altyapısı",
    description: "Aynı plaka veya müşteri için geçerli fiyatları otomatik hatırlama.",
    tag: "Yakında",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp ile servis çıktısı paylaşımı",
    description: "Profesyonel işlem tutanağını PDF veya WhatsApp mesajı olarak müşteriye iletin.",
    tag: null,
  },
];

export function FeaturesSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="ozellikler" className="py-16 sm:py-24 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Özellikler"
          title="Servisinizi yönetmek için ihtiyacınız olan"
          titleHighlight="temel yapı"
          subtitle="BakimX, masa başı değil sahada çalışan kullanıcıları düşünerek tasarlanır."
        />
        <div className="mt-12 grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
              className="group rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-base">{feature.title}</h3>
                {feature.tag && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {feature.tag}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}