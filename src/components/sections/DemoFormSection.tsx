import { PhoneCall, Clock, ShieldCheck } from "lucide-react";
import { HeroLeadForm } from "@/components/sections/HeroLeadForm";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/shared/reveal";

const points = [
  {
    icon: PhoneCall,
    title: "Sizi biz arayalım",
    description: "Servisinize göre kısa tanıtım, sorularınızın yanıtı.",
  },
  {
    icon: Clock,
    title: "Beklemeden başlayın",
    description: "İsterseniz aramayı beklemeden denemenizi hemen açın.",
  },
  {
    icon: ShieldCheck,
    title: "Karar vermeden önce deneyin",
    description: "Servisinizin günlük işlerini kendi hesabınızda görün.",
  },
];

export function DemoFormSection() {
  return (
    <section className="scroll-mt-24 border-t bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className="max-w-xl">
            <SectionHeading
              align="left"
              badge="Demo"
              title="Sizin serviste nasıl çalışır? Birlikte bakalım."
              subtitle="Servisinizde günü nasıl geçirdiğinizi anlatın. BakımX'in hangi işinizi kolaylaştıracağını birlikte görelim."
            />
            <ul className="mt-8 space-y-5">
              {points.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal
            delay={150}
            className="w-full lg:max-w-md lg:justify-self-end"
          >
            <HeroLeadForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
