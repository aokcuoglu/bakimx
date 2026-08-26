import { CheckCircle2, XCircle } from "lucide-react";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/shared/reveal";

const beforeItems = [
  "Kağıt formlar ve dağınık notlar",
  "WhatsApp'ta kaybolan fotoğraflar",
  "Excel'de elle takip",
  "Müşteriyle 'bu çizik var mıydı?' tartışması",
];

const afterItems = [
  "Tek panelde dijital iş emri",
  "Fotoğraf ve hasar kayıt altında, değiştirilemez",
  "Teklif, onay ve tahsilat otomatik akışta",
  "Kayıtlı müşteri onayı ve canlı takip linki",
];

export function BeforeAfterSection() {
  return (
    <section className="bg-muted/30 py-16 sm:py-24 overflow-x-clip">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Defterden panele geçin"
          subtitle="Servislerin her gün yaşadığı dağınıklığın BakimX'teki karşılığı:"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Reveal
            from="left"
            className="rounded-xl border bg-card p-6 sm:p-8"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Eski yöntem
            </h3>
            <ul className="mt-5 space-y-3.5">
              {beforeItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base text-muted-foreground">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive-strong" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal
            from="right"
            delay={100}
            className="rounded-xl border-2 border-primary/30 bg-card p-6 sm:p-8 shadow-lg shadow-primary/5"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              BakimX ile
            </h3>
            <ul className="mt-5 space-y-3.5">
              {afterItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-strong" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
