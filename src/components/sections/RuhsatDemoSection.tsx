"use client";

import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoOcrUpload } from "@/components/sections/demo-ocr-upload";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  ScanLine,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  CircleCheck,
} from "lucide-react";

/** İstemci tarafı demo: fotoğraftaki sabit örnek verileri gösterir; OCR veya katalog sorgusu yapmaz. */

type Field = {
  key: string;
  code: string; // ruhsat alan kodu (A, D.1, E...)
  label: string;
  value: string;
  wide?: boolean;
};

const FIELD_GROUPS: { key: string; title: string; fields: Field[] }[] = [
  {
    key: "vehicle",
    title: "Araç bilgileri",
    fields: [
      { key: "plate", code: "A", label: "Plaka", value: "34 LKN 123" },
      { key: "brand", code: "D.1", label: "Marka", value: "HONDA" },
      { key: "model", code: "D.3", label: "Model", value: "PCX 125" },
      { key: "year", code: "D.4", label: "Model yılı", value: "2024" },
      { key: "type", code: "D.2", label: "Tip", value: "JK05" },
      { key: "class", code: "J", label: "Araç sınıfı", value: "L3" },
      { key: "kind", code: "D.5", label: "Cinsi", value: "Motosiklet (taşıma kutulu)", wide: true },
      { key: "color", code: "R", label: "Renk", value: "Beyaz" },
      { key: "engine", code: "P.5", label: "Motor no", value: "JF81E-1234567" },
      { key: "vin", code: "E", label: "Şase no", value: "RLHJK05A8RY123456", wide: true },
    ],
  },
  {
    key: "technical",
    title: "Teknik özellikler",
    fields: [
      { key: "fuel", code: "P.3", label: "Yakıt", value: "Benzin" },
      { key: "displacement", code: "P.1", label: "Silindir hacmi", value: "125 cm³" },
      { key: "power", code: "P.2", label: "Motor gücü", value: "9.2 kW" },
      { key: "powerRatio", code: "Q", label: "Güç / ağırlık oranı", value: "0.078 kW/kg" },
      { key: "netWeight", code: "G.1", label: "Net ağırlık", value: "118 kg" },
      { key: "maxWeight", code: "F.1", label: "Azami yüklü ağırlık", value: "268 kg" },
      { key: "trainWeight", code: "G", label: "Katar ağırlığı", value: "---" },
      { key: "trailerWeight", code: "G.2", label: "Römork azami yüklü ağırlığı", value: "0 kg" },
      { key: "seats", code: "S.1", label: "Koltuk sayısı (sürücü dahil)", value: "2" },
      { key: "standing", code: "S.2", label: "Ayakta yolcu sayısı", value: "---" },
    ],
  },
  {
    key: "registration",
    title: "Tescil bilgileri",
    fields: [
      { key: "authority", code: "V.1", label: "Verildiği il / ilçe", value: "İstanbul / Ümraniye 50 Noterliği", wide: true },
      { key: "firstRegistration", code: "B", label: "İlk tescil tarihi", value: "15.05.2024" },
      { key: "registrationDate", code: "I", label: "Tescil tarihi", value: "15.05.2024" },
      { key: "registrationSequence", code: "Y.2", label: "Tescil sıra no", value: "20240515123456789012", wide: true },
      { key: "purpose", code: "Y.3", label: "Kullanım amacı", value: "Yolcu nakli - Ticari", wide: true },
      { key: "approval", code: "K", label: "Tip onay no", value: "e13*168/2013*00127*00", wide: true },
    ],
  },
];

const SAMPLE_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

const DEMO_PART_CATEGORIES = [
  "Fren balatası",
  "Hava filtresi",
  "Buji",
  "Varyatör kayışı",
];

type Phase = "idle" | "scanning" | "done";

export function RuhsatDemoSection() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealed, setRevealed] = useState(0); // görünen alan sayısı
  const [showParts, setShowParts] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setShowParts(false);
    setRevealed(0);
    setPhase("scanning");

    if (prefersReducedMotion) {
      setRevealed(SAMPLE_FIELDS.length);
      setShowParts(true);
      setPhase("done");
      return;
    }

    // Tarama çizgisi sonrası alanları tek tek doldur.
    const perField = 1800 / SAMPLE_FIELDS.length;
    const scanDelay = 900;
    SAMPLE_FIELDS.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => setRevealed(i + 1), scanDelay + i * perField),
      );
    });
    const afterFields = scanDelay + SAMPLE_FIELDS.length * perField;
    timers.current.push(setTimeout(() => setPhase("done"), afterFields));
    timers.current.push(setTimeout(() => setShowParts(true), afterFields + 250));
  }, [clearTimers, prefersReducedMotion]);

  const reset = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setRevealed(0);
    setShowParts(false);
  }, [clearTimers]);

  return (
    <section
      id="ruhsat-demo"
      className="scroll-mt-24 py-16 sm:py-24 bg-muted/30 overflow-x-clip"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Canlı Demo"
          title="Ruhsatı okut,"
          titleHighlight="araç bilgilerini otomatik doldur."
          subtitle="Ruhsat fotoğrafından araç bilgilerine uzanan akışı örnek verilerle deneyin."
        />

        <Tabs defaultValue="sample" onValueChange={reset} className="mt-10">
          <TabsList className="mx-auto mb-5 h-auto">
            <TabsTrigger value="sample">Örnek ruhsat</TabsTrigger>
            <TabsTrigger value="upload">Kendi ruhsatını dene</TabsTrigger>
          </TabsList>
          <TabsContent value="sample">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-start">
          {/* Sol: ruhsat + tarama */}
          <div className="rounded-xl border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
              <ScanLine className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Ruhsat Okuma</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Demo · örnek belge
              </span>
            </div>

            <div className="p-5 sm:p-6">
              <RuhsatDoc phase={phase} prefersReducedMotion={!!prefersReducedMotion} />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Bu demo, fotoğraftaki bilgileri örnek veri olarak gösterir.
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {phase === "idle" ? (
                  <Button
                    type="button"
                    onClick={start}
                    variant="gradient"
                    className="h-11 w-full gap-2 text-sm font-semibold"
                  >
                    <ScanLine className="h-4 w-4" />
                    Örnek ruhsatı okut
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={reset}
                    variant="outline"
                    className="h-11 w-full gap-2 border-primary/30"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Yeniden oynat
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Sağ: örnek bilgiler ve parça kategorileri */}
          <div className="rounded-xl border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
              <CircleCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Okunan Bilgiler</h3>
              {phase === "done" && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success-strong">
                  <CheckCircle2 className="size-3" />
                  Tamamlandı
                </span>
              )}
            </div>

            <div className="p-5 sm:p-6">
              {phase === "idle" ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary-strong">
                    <ScanLine className="size-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Soldaki <span className="font-medium text-foreground">“Örnek ruhsatı okut”</span> düğmesine
                    basın; fotoğraftaki araç bilgileri burada belirsin.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-xs text-muted-foreground">
                    {SAMPLE_FIELDS.length} alan · Fotoğraftaki örnek bilgiler
                  </p>
                  <div className="space-y-5">
                    {FIELD_GROUPS.map((group) => (
                      <div key={group.key}>
                        <h4 id={`ruhsat-${group.key}`} className="mb-2 text-sm font-semibold">
                          {group.title}
                        </h4>
                        <dl aria-labelledby={`ruhsat-${group.key}`} className="grid grid-cols-2 gap-2">
                          {group.fields.map((field) => (
                            <FieldCell
                              key={field.key}
                              field={field}
                              shown={SAMPLE_FIELDS.indexOf(field) < revealed}
                            />
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>

                  {showParts && (
                    <div
                      style={{ "--enter-from": "0.75rem", "--enter-duration": "0.4s" } as CSSProperties}
                      className="enter-up mt-5 border-t pt-5"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <p className="text-sm font-semibold">Örnek motosiklet parça kategorileri</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {DEMO_PART_CATEGORIES.map((part, i) => (
                          <div
                            key={part}
                            style={{ "--enter-delay": `${i * 60}ms` } as CSSProperties}
                            className="enter-pop rounded-lg border bg-muted/40 px-3 py-2"
                          >
                            <p className="text-xs font-medium">{part}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Demo
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-xs italic text-muted-foreground">
                        Kategoriler tanıtım amaçlıdır; şase eşleşmesi veya parça uyumu doğrulanmamıştır.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
          </TabsContent>
          <TabsContent value="upload"><DemoOcrUpload /></TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

/** Orijinal fotoğrafı kırpmadan gösteren belge alanı ve demo tarama durumu. */
function RuhsatDoc({
  phase,
  prefersReducedMotion,
}: {
  phase: Phase;
  prefersReducedMotion: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted/50 p-4 sm:p-5">
      <Image
        src="/landing/ruhsat-demo.png"
        alt="34 LKN 123 plakalı, 2024 model Honda PCX 125 motosikletin ruhsat fotoğrafı"
        width={721}
        height={1024}
        sizes="(min-width: 640px) 310px, 254px"
        className="mx-auto h-auto max-h-[360px] w-auto max-w-full rounded-sm object-contain shadow-sm sm:max-h-[440px]"
      />
      {phase === "scanning" && !prefersReducedMotion && (
        <div aria-hidden="true" className="ruhsat-scan-line pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
      )}
      {phase !== "idle" && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm ${
              phase === "scanning"
                ? "bg-primary text-primary-foreground"
                : "bg-success text-success-foreground"
            }`}
          >
            <ScanLine className="size-3.5" />
            {phase === "scanning" ? "Demo çalışıyor…" : "Demo tamamlandı"}
          </span>
        </div>
      )}
    </div>
  );
}

/** Sağdaki örnek bilgi hücresi. */
function FieldCell({
  field,
  shown,
}: {
  field: Field;
  shown: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-lg border border-border bg-muted/40 px-3 py-2 ${field.wide ? "col-span-2" : ""}`}>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {field.label} <span className="text-muted-foreground">({field.code})</span>
      </dt>
      <dd className="mt-0.5 flex items-center gap-1.5">
        {shown ? (
          <span
            style={{ "--enter-from": "0.25rem", "--enter-duration": "0.2s" } as CSSProperties}
            className="enter-up break-all font-mono text-sm font-medium"
          >
            {field.value}
          </span>
        ) : (
          <span className="h-4 w-16 animate-pulse rounded bg-muted-foreground/20" />
        )}
      </dd>
    </div>
  );
}
