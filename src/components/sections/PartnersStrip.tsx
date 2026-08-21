import type { CSSProperties } from "react";
import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";

// Renkli PNG logolar: varsayılan monochrome (grayscale + düşük opaklık), üstüne
// gelince tam renk. Koyu temada logoların koyu kısımları zeminde kaybolduğu için
// beyaz chip içinde gösterilir (chip padding'i Image yerine sarmalayıcıda: border-box
// img'de en-boy oranını bozuyordu).
const partners = [
  {
    name: "Mutlu Akü",
    src: "/landing/partners/mutlu.png",
    width: 96,
    height: 44,
    imgClass:
      "opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 dark:opacity-100 dark:grayscale-0",
    wrapClass: "dark:rounded-md dark:bg-white dark:p-1.5",
  },
  {
    name: "AWS Startups",
    src: "/landing/partners/aws-startups.png",
    width: 114,
    height: 30,
    imgClass:
      "opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 dark:opacity-100 dark:grayscale-0",
    wrapClass: "dark:rounded-md dark:bg-white dark:p-1.5",
  },
];

export function PartnersStrip() {
  return (
    <section className="border-b bg-background py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal
          as="p"
          from="fade"
          amount={0.3}
          className="text-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
        >
          Güçlü iş ortakları ve altyapıyla çalışıyoruz
        </Reveal>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-14 gap-y-6">
          {partners.map((partner, i) => (
            <Reveal
              key={partner.name}
              delay={i * 80}
              amount={0.3}
              style={{ "--reveal-y": "0.5rem" } as CSSProperties}
              className={partner.wrapClass}
            >
              <Image
                src={partner.src}
                alt={partner.name}
                width={partner.width}
                height={partner.height}
                className={partner.imgClass}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
