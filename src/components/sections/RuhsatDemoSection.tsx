"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  ScanLine,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Pencil,
  CircleCheck,
} from "lucide-react";

/**
 * Landing'e özel, tamamen istemci-tarafı interaktif demo. Gerçek OCR/RapidAPI
 * çağrısı YAPMAZ — canned örnek veriyle ruhsat okuma + VIN-uyumlu parça deneyimini
 * gösterir. Ziyaretçiye "aha" anını yaşatıp kayda yönlendirir.
 *
 * Dürüstlük: parçalar araca UYGUN katalog parçalarıdır; fiyat/temin iddiası yoktur.
 */

type Field = {
  key: string;
  code: string; // ruhsat alan kodu (A, D.1, E...)
  label: string;
  value: string;
  lowConf?: boolean; // gerçekteki "düşük güven" vurgusunu yansıtır
};

const SAMPLE_FIELDS: Field[] = [
  { key: "plate", code: "A", label: "Plaka", value: "34 ABC 123" },
  { key: "brand", code: "D.1", label: "Marka", value: "HONDA" },
  { key: "model", code: "D.3", label: "Model", value: "CIVIC 1.6 i-DTEC" },
  { key: "vin", code: "E", label: "Şasi (VIN)", value: "SHHFK2••••U201234", lowConf: true },
  { key: "year", code: "D.4", label: "Model yılı", value: "2018" },
  { key: "fuel", code: "P.3", label: "Yakıt", value: "Dizel" },
];

type Part = {
  name: string;
  brand: string;
  ref: string;
};

const COMPATIBLE_PARTS: Part[] = [
  { name: "Ön fren balatası", brand: "BOSCH", ref: "0 986 494 700" },
  { name: "Yağ filtresi", brand: "MAHLE", ref: "OX 813/1" },
  { name: "Hava filtresi", brand: "MANN", ref: "C 2433" },
  { name: "Ön amortisör", brand: "SACHS", ref: "314 875" },
  { name: "Debriyaj seti", brand: "LUK", ref: "624 3729 00" },
  { name: "Triger seti", brand: "GATES", ref: "K015649XS" },
];

type Phase = "idle" | "scanning" | "done";

export function RuhsatDemoSection() {
  const prefersReducedMotion = useReducedMotion();
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
    const perField = 340;
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
          subtitle="Örnek bir ruhsatla deneyin: araç bilgileri otomatik dolsun, VIN'iyle eşleşen uygun parçalar karşınıza gelsin."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12 items-start">
          {/* Sol: ruhsat + tarama */}
          <div className="rounded-xl border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
              <ScanLine className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Ruhsat Okuma</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Demo · örnek ruhsat
              </span>
            </div>

            <div className="p-5 sm:p-6">
              <RuhsatDoc phase={phase} prefersReducedMotion={!!prefersReducedMotion} />

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {phase === "idle" ? (
                  <button
                    type="button"
                    onClick={start}
                    className={buttonVariants({
                      size: "default",
                      className:
                        "w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90",
                    })}
                  >
                    <ScanLine className="h-4 w-4" />
                    Örnek ruhsatı okut
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={reset}
                    className={buttonVariants({
                      variant: "outline",
                      size: "default",
                      className: "w-full gap-2 border-primary/30",
                    })}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Yeniden oynat
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sağ: sonuç (alanlar + uyumlu parçalar) */}
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
                    basın; araç bilgileri ve uygun parçalar burada belirsin.
                  </p>
                </div>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-2.5">
                    {SAMPLE_FIELDS.map((field, i) => (
                      <FieldCell
                        key={field.key}
                        field={field}
                        shown={i < revealed}
                        prefersReducedMotion={!!prefersReducedMotion}
                      />
                    ))}
                  </dl>

                  <AnimatePresence>
                    {showParts && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="mt-5 border-t pt-5"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="size-4 text-primary" />
                          <p className="text-sm font-semibold">VIN eşleşti — araca uygun parçalar</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {COMPATIBLE_PARTS.map((part, i) => (
                            <motion.div
                              key={part.ref}
                              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.25, delay: prefersReducedMotion ? 0 : i * 0.06 }}
                              className="rounded-lg border bg-muted/40 px-3 py-2"
                            >
                              <p className="text-xs font-medium">{part.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {part.brand} · {part.ref}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                        <p className="mt-4 text-xs italic text-muted-foreground">
                          VIN&apos;iyle eşleşen, araca uygun katalog parçaları. Fiyatları kendi
                          kataloğunuzdan siz belirlersiniz.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CTA */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-10 flex flex-col items-center gap-3 text-center"
            >
              <p className="text-base font-medium">
                Kendi aracınızla deneyin — ruhsatı okutun, işi araç bilgileriyle başlatın.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/register"
                  className={buttonVariants({
                    size: "default",
                    className:
                      "gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 sm:px-8 shadow-lg shadow-primary/25",
                  })}
                >
                  15 Gün Ücretsiz Dene
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/demo"
                  className={buttonVariants({ variant: "outline", size: "default", className: "px-4 sm:px-8 border-primary/30" })}
                >
                  Demo İste
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/** Sol taraftaki stilize ruhsat belgesi + tarama çizgisi. */
function RuhsatDoc({
  phase,
  prefersReducedMotion,
}: {
  phase: Phase;
  prefersReducedMotion: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5">
      {/* Belge başlığı */}
      <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            T.C. — Araç Tescil Belgesi
          </p>
          <p className="text-[10px] text-muted-foreground">Ruhsat (örnek / temsili)</p>
        </div>
        <div className="rounded bg-primary/10 px-2 py-1 text-[10px] font-mono font-semibold text-primary-strong">
          34 ABC 123
        </div>
      </div>

      {/* Belge satırları (temsili — okunması zor, gerçekçi görünüm) */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {[
          ["A", "34 ABC 123"],
          ["D.1", "HONDA"],
          ["D.3", "CIVIC 1.6 i-DTEC"],
          ["E", "SHHFK2••••U201234"],
          ["D.4", "2018"],
          ["P.3", "DİZEL"],
        ].map(([code, val]) => (
          <div key={code} className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{code}</p>
            <p className="truncate font-mono text-[11px] text-foreground">{val}</p>
          </div>
        ))}
      </div>

      {/* Tarama çizgisi */}
      <AnimatePresence>
        {phase === "scanning" && !prefersReducedMotion && (
          <motion.div
            initial={{ top: "0%", opacity: 0 }}
            animate={{ top: ["0%", "100%", "0%"], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
            className="pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-primary/25 to-transparent"
          />
        )}
      </AnimatePresence>

      {phase !== "idle" && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-primary">
          <ScanLine className="size-3.5" />
          {phase === "scanning" ? "Okunuyor…" : "Okundu"}
        </div>
      )}
    </div>
  );
}

/** Sağdaki okunan alan hücresi (görünme animasyonu + düşük-güven vurgusu). */
function FieldCell({
  field,
  shown,
  prefersReducedMotion,
}: {
  field: Field;
  shown: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: shown ? 1 : 0.35 }}
      transition={{ duration: 0.25 }}
      className={`rounded-lg border px-3 py-2 ${
        shown && field.lowConf
          ? "border-warning/50 bg-warning/10"
          : "border-border bg-muted/40"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {field.label} <span className="text-muted-foreground">({field.code})</span>
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {shown ? (
          <motion.span
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="truncate font-mono text-sm font-medium"
          >
            {field.value}
          </motion.span>
        ) : (
          <span className="h-4 w-16 animate-pulse rounded bg-muted-foreground/20" />
        )}
        {shown && field.lowConf && (
          <span
            className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning/20 px-1.5 py-0.5 text-[9px] font-medium text-warning-strong"
            title="Düşük güven — kaydetmeden önce kontrol edin"
          >
            <Pencil className="size-2.5" />
            düzelt
          </span>
        )}
      </div>
    </motion.div>
  );
}
