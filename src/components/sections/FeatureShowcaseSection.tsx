"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { BrowserFrame, PhoneFrame } from "@/components/sections/DeviceFrame";

interface Feature {
  kicker: string;
  title: string;
  description: string;
  bullets: string[];
  image: { src: string; width: number; height: number; alt: string };
  frame: "browser" | "phone";
}

const features: Feature[] = [
  {
    kicker: "İş Emri",
    title: "Tek iş emrinde her şey: fotoğraf, kalem, onay",
    description:
      "Kabulden teslimata bütün süreç tek sayfada. Fotoğraf kanıtı ve hasar haritası iş emrine kilitlenir; işlem geçmişi kim-ne-zaman yaptı gösterir.",
    bullets: [
      "Fotoğraf checklist ve hasar işaretleme",
      "Kanıtlar değiştirilemez — anlaşmazlık biter",
      "Teklif, onay ve tahsilat aynı ekranda",
    ],
    image: {
      src: "/landing/screens/order-detail.png",
      width: 1440,
      height: 900,
      alt: "BakimX iş emri detay ekranı",
    },
    frame: "browser",
  },
  {
    kicker: "Parça Kataloğu",
    title: "Şasiden araca uygun parçayı bulun",
    description:
      "Ruhsattan gelen şasi (VIN) numarası araç modeliyle eşleşir; iş emrine parça eklerken yalnız o araca uyan parçaları görürsünüz.",
    bullets: [
      "VIN'den otomatik araç eşleşmesi",
      "Araca uygun parça listesi, elle arama yok",
      "Seçilen parça tek tıkla iş emri kalemi olur",
    ],
    image: {
      src: "/landing/screens/parts-catalog.png",
      width: 1440,
      height: 900,
      alt: "BakimX araca uygun parça kataloğu",
    },
    frame: "browser",
  },
  {
    kicker: "Müşteri Deneyimi",
    title: "Müşteriniz aracını canlı izler",
    description:
      "Her iş emri için güvenli bir takip linki oluşur. Müşteri telefonundan aracın durumunu, fotoğrafları ve teklifi görür — sizi aramasına gerek kalmaz.",
    bullets: [
      "Kişiye özel güvenli takip linki",
      "WhatsApp'tan tek dokunuşla paylaşım",
      "Onay ve teslimat kayıt altında",
    ],
    image: {
      src: "/landing/screens/public-tracking.png",
      width: 390,
      height: 844,
      alt: "Müşteri canlı servis takip sayfası (mobil)",
    },
    frame: "phone",
  },
];

export function FeatureShowcaseSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="ozellikler" className="scroll-mt-24 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl space-y-20 px-4 sm:px-6 sm:space-y-28 lg:px-8">
        {features.map((feature, i) => {
          const reversed = i % 2 === 1;
          return (
            <div
              key={feature.title}
              className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                reversed ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, x: reversed ? 24 : -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5 }}
              >
                {feature.frame === "browser" ? (
                  <BrowserFrame>
                    <Image
                      src={feature.image.src}
                      alt={feature.image.alt}
                      width={feature.image.width}
                      height={feature.image.height}
                      sizes="(min-width: 1024px) 560px, 100vw"
                      className="w-full"
                    />
                  </BrowserFrame>
                ) : (
                  <PhoneFrame>
                    <Image
                      src={feature.image.src}
                      alt={feature.image.alt}
                      width={feature.image.width}
                      height={feature.image.height}
                      sizes="300px"
                      className="w-full"
                    />
                  </PhoneFrame>
                )}
              </motion.div>
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="max-w-xl"
              >
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                  {feature.kicker}
                </p>
                <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                  {feature.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm sm:text-base">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/#demo-form"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Demo iste
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
