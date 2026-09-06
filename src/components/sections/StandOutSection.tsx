import {
  ScanLine,
  Puzzle,
  Lock,
  Link2,
  Smartphone,
  Workflow,
} from "lucide-react";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/shared/reveal";

const differentiators = [
  {
    icon: ScanLine,
    title: "Ruhsatla otomatik kabul",
    description: "Araç, müşteri ve şasi bilgisi ruhsat fotoğrafından otomatik dolar.",
  },
  {
    icon: Puzzle,
    title: "Araca uygun parça kataloğu",
    description: "İş emrine yalnız o araca uyan parçalar eklenir.",
  },
  {
    icon: Lock,
    title: "Değiştirilemez fotoğraf kanıtı",
    description: "Kabul fotoğrafları ve hasar haritası kilitlenir; tartışma kayıtla kapanır.",
  },
  {
    icon: Link2,
    title: "Müşteriye canlı takip linki",
    description: "Müşteri aracın durumunu telefonundan izler; çıktılar WhatsApp'tan gider.",
  },
  {
    icon: Smartphone,
    title: "Mobil öncelikli, kurulumsuz",
    description: "Kurulum yok; telefon veya bilgisayardan aynı gün başlarsınız.",
  },
  {
    icon: Workflow,
    title: "Uçtan uca servis akışı",
    description: "Kabulden iş emrine, onaydan tahsilata kadar tüm süreç tek kayıtta ilerler.",
  },
];

export function StandOutSection() {
  return (
    <section id="neden" className="scroll-mt-24 bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Neden BakimX"
          title="Bizi diğer programlardan ayıran ne?"
          subtitle="Klasik programlar kayıt tutar; BakimX işin sahada nasıl aktığını bilir — kamerayla kabul, kanıtla teslim."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {differentiators.map(({ icon: Icon, title, description }, i) => (
            <Reveal
              key={title}
              delay={(i % 3) * 80}
              className="flex flex-col items-start rounded-xl border bg-card p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
