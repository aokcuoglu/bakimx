import { Wrench, Gauge, Disc3, SprayCan, Zap, Truck } from "lucide-react";
import { BrandEyebrow } from "@/components/shared/brand-decor";
import { Reveal } from "@/components/shared/reveal";

/**
 * "Kimler için" — Shopmonkey "pick your lane"in dürüst hali.
 * Dürüstlük: BakimX genel oto servis yazılımıdır; her tip için ayrı "uzmanlaşmış
 * modül" iddiası YOKTUR. Süreç (kabul → iş emri → kanıt → teslim) her araç tipinde
 * aynıdır; aşağıdakiler bu akıştan bugün faydalanabilecek servis tipleridir.
 */

const segments = [
  { icon: Wrench, title: "Genel oto tamir & bakım", description: "Mekanik onarım, motor ve genel bakım işleri." },
  { icon: Gauge, title: "Periyodik bakım & yağ", description: "Km bazlı bakım, yağ ve filtre değişimi." },
  { icon: Disc3, title: "Lastik & rot-balans", description: "Lastik, jant, rot-balans ve süspansiyon işleri." },
  { icon: SprayCan, title: "Kaporta & boya", description: "Hasar tespiti, kaporta ve boya süreçleri." },
  { icon: Zap, title: "Oto elektrik", description: "Arıza tespiti, elektrik ve elektronik işler." },
  { icon: Truck, title: "Ağır vasıta & ticari", description: "Ticari araç ve filo bakım-onarım takibi." },
];

export function SegmentsSection() {
  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <BrandEyebrow>Kimler için</BrandEyebrow>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Aracın girip çıktığı her servise göre
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Süreç her araç tipinde aynı: kabul, iş emri, fotoğraf kanıtı, teslim.
            Aşağıdaki servisler BakimX&apos;i bugün kullanabilir.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map(({ icon: Icon, title, description }, i) => (
            <Reveal
              key={title}
              delay={(i % 3) * 80}
              className="flex items-start gap-4 rounded-xl border bg-card p-5 sm:p-6"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
