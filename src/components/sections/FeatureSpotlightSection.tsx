"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { CarDamageIllustration } from "@/components/sections/car-damage-illustration";
import {
  CheckCircle2,
  FileText,
  Search,
  Sparkles,
  MousePointerClick,
} from "lucide-react";

export function FeatureSpotlightSection() {
  return (
    <section id="ozellikler" className="py-16 sm:py-24 bg-background overflow-x-clip">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Özellikler"
          title="İşinizi hızlandıran"
          titleHighlight="öne çıkan özellikler"
          subtitle="Servis gününüzü kısaltan, müşteriye güven veren detaylar."
        />
        <div className="mt-16 flex flex-col gap-16 sm:gap-24">
          <SpotlightRow
            reverse={false}
            text={
              <FeatureText
                title="Tek iş emrinde her şey"
                description="Parça, işçilik, fotoğraf, hasar ve tahsilat aynı iş emrinde birleşir; aracın geçmişi tek yerde toplanır."
                bullets={[
                  "Parça + işçilik satırları, otomatik tutar",
                  "Fotoğraf checklist'i ve 2D hasar işaretleme",
                  "Ödeme ve teslimat durumu tek ekranda",
                ]}
              />
            }
            visual={<DamageMapCard />}
          />

          <SpotlightRow
            reverse
            text={
              <FeatureText
                title="Dakikalar içinde teklif"
                description="Kendi parça-işçilik kataloğunuzdan saniyeler içinde teklif hazırlayın, WhatsApp'tan onaya gönderin. Onaylanan teklif tek tıkla iş emrine döner."
                bullets={[
                  "Katalogdan parça & işçilik seçimi",
                  "Otomatik tutar, indirim ve KDV",
                  "WhatsApp veya link ile onay",
                ]}
                microcopy="Fiyatlar sizin kataloğunuzdan gelir; tutar otomatik hesaplanır."
              />
            }
            visual={<QuoteCatalogCard />}
          />

          <SpotlightRow
            reverse={false}
            text={
              <FeatureText
                tag="Premium"
                title="AI servis danışmanı"
                description="Müşterinin şikâyetine ve araca göre yapılacak kontrolleri, işçilik ve parçaları önersin; tek dokunuşla teklife dönüştürün."
                bullets={[
                  "Önerilen kontroller ve işçilikler",
                  "Olası parça ihtiyaçları",
                  "Müşteriye uygun açıklama metni",
                ]}
                microcopy="Öneridir; fiyat belirlemez, kesin teşhis değildir."
              />
            }
            visual={<AiAdvisorCard />}
          />
        </div>
      </div>
    </section>
  );
}

function SpotlightRow({
  reverse,
  text,
  visual,
}: {
  reverse: boolean;
  text: React.ReactNode;
  visual: React.ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, x: reverse ? 40 : -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
        className={reverse ? "lg:order-2" : ""}
      >
        {text}
      </motion.div>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, x: reverse ? -40 : 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className={reverse ? "lg:order-1" : ""}
      >
        {visual}
      </motion.div>
    </div>
  );
}

function FeatureText({
  tag,
  title,
  description,
  bullets,
  microcopy,
}: {
  tag?: string;
  title: string;
  description: string;
  bullets: string[];
  microcopy?: string;
}) {
  return (
    <div>
      {tag && (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
          {tag}
        </span>
      )}
      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h3>
      <p className="mt-3 text-muted-foreground leading-relaxed">{description}</p>
      <ul className="mt-5 space-y-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm">
            <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {microcopy && (
        <p className="mt-4 text-xs italic text-muted-foreground/80">{microcopy}</p>
      )}
    </div>
  );
}

function DamageMapCard() {
  return (
    <div className="rounded-lg border bg-card shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
        <MousePointerClick className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">2D Hasar Haritası</h4>
        <span className="ml-auto text-xs text-muted-foreground">3 hasar işaretli</span>
      </div>
      <div className="p-6">
        <div className="flex justify-center rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-8">
          <CarDamageIllustration className="h-52 w-auto" />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {[
            { c: "bg-destructive", l: "Ağır" },
            { c: "bg-warning", l: "Orta" },
            { c: "bg-brand", l: "Hafif" },
          ].map((it) => (
            <div key={it.l} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-full ${it.c}`} />
              {it.l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuoteCatalogCard() {
  return (
    <div className="rounded-lg border bg-card shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
        <FileText className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Yeni Teklif</h4>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Search className="size-4" />
          <span>Katalogda parça ara…</span>
        </div>
        <CatalogRow name="Ön fren balatası" meta="Stok: 12 · BR-1042" price="₺1.200" />
        <CatalogRow name="Yağ filtresi" meta="Stok: 30 · OF-220" price="₺350" />
        <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
          <span>Teklif tutarı</span>
          <span>₺1.550</span>
        </div>
      </div>
    </div>
  );
}

function CatalogRow({
  name,
  meta,
  price,
}: {
  name: string;
  meta: string;
  price: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-[11px] text-muted-foreground">{meta}</p>
      </div>
      <span className="text-sm font-medium">{price}</span>
    </div>
  );
}

function AiAdvisorCard() {
  return (
    <div className="rounded-lg border bg-card shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-gradient-to-r from-primary/10 to-transparent px-5 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">AI Servis Danışmanı</h4>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          Premium
        </span>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-xs text-muted-foreground">
          Şikâyet:{" "}
          <span className="text-foreground">&quot;Frene basınca ses geliyor&quot;</span>
        </p>
        <AdvisorBlock label="Önerilen kontroller" items={["Balata aşınması", "Disk yüzeyi", "Fren hidroliği"]} />
        <AdvisorBlock label="Olası parça ihtiyaçları" items={["Ön balata", "Fren diski"]} />
        <p className="pt-1 text-[11px] italic text-muted-foreground">
          Öneridir; fiyat belirlemez, kesin teşhis değildir.
        </p>
      </div>
    </div>
  );
}

function AdvisorBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
