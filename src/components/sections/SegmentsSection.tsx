import { Wrench, Gauge, Disc3, SprayCan, Zap, Truck } from "lucide-react";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/shared/reveal";

/**
 * "Kimler için" — Shopmonkey "pick your lane"in dürüst hali.
 * Dürüstlük: BakimX genel oto servis yazılımıdır; her tip için ayrı "uzmanlaşmış
 * modül" iddiası YOKTUR. Süreç (kabul → iş emri → kanıt → teslim) her araç tipinde
 * aynıdır; aşağıdakiler bu akıştan bugün faydalanabilecek servis tipleridir.
 *
 * Açıklama metni YOK: "kimler için" doğrulama içeriğidir, tek satırlık spec
 * satırı yeterli (UI denetimi §3.1 + metin rafinasyonu).
 */

const segments = [
  { icon: Wrench, title: "Genel oto tamir & bakım" },
  { icon: Gauge, title: "Periyodik bakım & yağ" },
  { icon: Disc3, title: "Lastik & rot-balans" },
  { icon: SprayCan, title: "Kaporta & boya" },
  { icon: Zap, title: "Oto elektrik" },
  { icon: Truck, title: "Ağır vasıta & ticari" },
];

export function SegmentsSection() {
  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Kimler için"
          title="Aracın girip çıktığı her servise göre"
          subtitle="Süreç her araç tipinde aynı: kabul, iş emri, fotoğraf kanıtı, teslim."
        />
        {/* Kart değil spec-satırı: üstteki StandOut ızgarasıyla aynı kart
            anatomisini tekrarlamamak için (UI denetimi §3.1) — mono markanın
            liste dokusu, "kimler için" doğrulama içeriğine daha uygun. */}
        <div className="mt-12 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map(({ icon: Icon, title }, i) => (
            <Reveal
              key={title}
              delay={(i % 3) * 80}
              className="flex items-center gap-3.5 border-b py-5"
            >
              <Icon aria-hidden className="h-5 w-5 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold">{title}</h3>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
