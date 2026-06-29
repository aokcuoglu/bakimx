"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ScanLine, FileText, MessageSquare, Wallet } from "lucide-react";

const steps = [
  {
    icon: ScanLine,
    title: "Aracı kabul edin",
    description:
      "Plaka/ruhsat okuma ile araç ve müşteriyi saniyede kaydedin; fotoğraf checklist'i ve gerekirse 2D hasar işaretlemesiyle aracı belgeleyin.",
  },
  {
    icon: FileText,
    title: "İş emri & teklif oluşturun",
    description:
      "Parça ve işçilik satırlarıyla iş emri açın; tek tıkla teklife çevirin, tutar otomatik hesaplansın.",
  },
  {
    icon: MessageSquare,
    title: "Müşteri onayını alın",
    description:
      "Teklifi WhatsApp veya link ile gönderin; müşteri görüntüleyip onaylasın.",
  },
  {
    icon: Wallet,
    title: "Teslim edin & tahsil edin",
    description:
      "Teslimat onayıyla aracı teslim edin, tahsilatı kasaya işleyin, bir sonraki bakım hatırlatmasını kurun.",
  },
];

export function HowItWorksSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="nasil-calisir" className="py-16 sm:py-24 bg-muted/30 overflow-x-clip">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Nasıl Çalışır"
          title="Aracı kabul edin,"
          titleHighlight="parayı tahsil edin."
          subtitle="Kabulden teslimata, günlük işiniz tek akışta."
        />
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
          <ol className="flex flex-col gap-6">
            {steps.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <motion.li
                  key={step.title}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />
                    )}
                  </div>
                  <div className="pb-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StepIcon className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
          >
            <WorkflowPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function WorkflowPreview() {
  return (
    <div className="rounded-lg border bg-card shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">İş Emri #1042</h3>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          Hazırlanıyor
        </span>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground">34 ABC 123</span>
          <span>Ahmet Yılmaz</span>
        </div>
        <div className="space-y-2">
          <LineRow type="Parça" label="Ön fren balatası" amount="₺1.200" />
          <LineRow type="İşçilik" label="Fren bakımı" amount="₺800" />
        </div>
        <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
          <span>Toplam</span>
          <span>₺2.000</span>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-lg bg-whatsapp/10 py-2.5 text-sm font-medium text-whatsapp">
          <MessageSquare className="size-4" />
          WhatsApp ile onaya gönder
        </div>
      </div>
    </div>
  );
}

function LineRow({
  type,
  label,
  amount,
}: {
  type: string;
  label: string;
  amount: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {type}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium">{amount}</span>
    </div>
  );
}
