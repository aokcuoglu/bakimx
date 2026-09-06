import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";

// Renkli PNG logolar, soluklaştırma YOK: önceki grayscale+%60 opaklık işlemi
// hover'a bağımlıydı ve mobilde hover olmadığı için light temada logolar hep
// gri-soluk duruyordu (UI denetimi §3.6). Koyu temada logoların koyu
// kısımları zeminde kaybolmasın diye beyaz chip içinde gösterilir.
const partners = [
  {
    name: "AWS Startups",
    src: "/landing/partners/aws-startups.png",
    width: 114,
    height: 30,
  },
];

export function PartnersStrip() {
  return (
    <section className="bg-gradient-to-b from-navy/75 via-navy/40 to-background py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* İki referansla "güçlü iş ortakları" iddiası abartı olur; nötr etiket
            yeterli. Logo sayısı artana kadar bölüm bilinçli olarak minik kalır. */}
        <Reveal
          as="p"
          from="fade"
          amount={0.3}
          className="text-center font-mono text-xs uppercase tracking-[0.18em] text-white"
        >
          Altyapı ve iş ortaklarımız
        </Reveal>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
          {partners.map((partner, i) => (
            <Reveal key={partner.name} delay={i * 80} amount={0.3}>
              <div className="rounded-md bg-white/15 p-1.5">
                <Image
                  src={partner.src}
                  alt={partner.name}
                  width={partner.width}
                  height={partner.height}
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
