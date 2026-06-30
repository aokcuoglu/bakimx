"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  Wrench,
  FileText,
  CalendarClock,
  HardHat,
  ShieldCheck,
  Boxes,
  Truck,
  Wallet,
  BarChart3,
  Users,
  MessageSquare,
  BellRing,
  Share2,
  Sparkles,
  ScanLine,
  Activity,
} from "lucide-react";

type ModuleItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
};

type Cluster = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle: string;
  items: ModuleItem[];
};

const clusters: Cluster[] = [
  {
    title: "Servis Operasyonu",
    icon: Wrench,
    subtitle: "Kabulden teslimata günlük akış.",
    items: [
      { label: "İş emri", icon: Wrench },
      { label: "Teklif", icon: FileText },
      { label: "Randevu & takvim", icon: CalendarClock },
      { label: "Teknisyen paneli", icon: HardHat },
      { label: "Müşteri onayı & teslimat", icon: ShieldCheck },
    ],
  },
  {
    title: "Depo & Finans",
    icon: Boxes,
    subtitle: "Stoğunuz ve nakdiniz kontrol altında.",
    items: [
      { label: "Stok / parçalar", icon: Boxes },
      { label: "Tedarikçiler", icon: Truck },
      { label: "Kasa & tahsilat", icon: Wallet },
      { label: "Yaşlandırma raporu", icon: BarChart3 },
    ],
  },
  {
    title: "Müşteri & İletişim",
    icon: Users,
    subtitle: "Müşteriyle bağınızı canlı tutun.",
    items: [
      { label: "Müşteri & araç yönetimi", icon: Users },
      { label: "SMS / WhatsApp / e-posta", icon: MessageSquare },
      { label: "Bakım hatırlatmaları", icon: BellRing },
      { label: "Müşteriye özet sayfası", icon: Share2 },
    ],
  },
  {
    title: "Akıllı Araçlar & Analiz",
    icon: Sparkles,
    subtitle: "Daha az emekle daha çok bilgi.",
    items: [
      { label: "AI servis danışmanı", icon: Sparkles, tag: "Premium" },
      { label: "Ruhsat & plaka okuma", icon: ScanLine },
      { label: "Operasyonel analiz", icon: Activity },
      { label: "Raporlar", icon: BarChart3 },
    ],
  },
];

export function ModulesSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="moduller" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Modüller"
          title="Tüm operasyon"
          titleHighlight="tek platformda"
          subtitle="Kâğıt, WhatsApp ve Excel'e dağılan işinizi tek panelde toplayın."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {clusters.map((cluster, i) => {
            const ClusterIcon = cluster.icon;
            return (
              <motion.div
                key={cluster.title}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="h-full rounded-lg bg-card p-5 ring-1 ring-foreground/10"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ClusterIcon className="size-5" />
                  </div>
                  <h3 className="font-semibold">{cluster.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{cluster.subtitle}</p>
                <ul className="mt-4 space-y-2.5">
                  {cluster.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <li key={item.label} className="flex items-center gap-2.5 text-sm">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <ItemIcon className="size-3.5" />
                        </div>
                        <span className="font-medium">{item.label}</span>
                        {item.tag && (
                          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {item.tag}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
