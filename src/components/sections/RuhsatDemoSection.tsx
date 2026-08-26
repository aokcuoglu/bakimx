"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  ScanLine,
  CheckCircle2,
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
 * Belge GERÇEK ruhsat düzenine göre çizilir (alan kodları A/B/C/D/E..., mavi
 * çerçeve, kırmızı kaşe) ama içerik temsilidir — kart başlığındaki
 * "Demo · örnek ruhsat" etiketi bunu açıkça söyler.
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
                      />
                    ))}
                  </dl>

                  {showParts && (
                    <div
                      style={{ "--enter-from": "0.75rem", "--enter-duration": "0.4s" } as CSSProperties}
                      className="enter-up mt-5 border-t pt-5"
                    >
                        <div className="flex items-center gap-2">
                          <Sparkles className="size-4 text-primary" />
                          <p className="text-sm font-semibold">VIN eşleşti — araca uygun parçalar</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {COMPATIBLE_PARTS.map((part, i) => (
                            <div
                              key={part.ref}
                              style={{ "--enter-delay": `${i * 60}ms` } as CSSProperties}
                              className="enter-pop rounded-lg border bg-muted/40 px-3 py-2"
                            >
                              <p className="text-xs font-medium">{part.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {part.brand} · {part.ref}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-4 text-xs italic text-muted-foreground">
                          VIN&apos;iyle eşleşen, araca uygun katalog parçaları. Fiyatları kendi
                          kataloğunuzdan siz belirlersiniz.
                        </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Sol taraftaki GERÇEKÇİ ruhsat belgesi + tarama çizgisi.
 *
 * Gerçek tescil belgesinin düzeni taklit edilir: koyu zemin üzerinde hafif
 * yatık duran belge, mavi çift çerçeve, alan kodlu iki kolon (A plaka, D.1
 * marka, E şasi...), alt köşede kırmızı kaşe ve QR bloğu, el yazısı plaka.
 * İçerik temsilidir; kart başlığındaki rozet bunu belirtir.
 */
function RuhsatDoc({
  phase,
  prefersReducedMotion,
}: {
  phase: Phase;
  prefersReducedMotion: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-navy px-4 py-7 sm:px-8 sm:py-9">
      {/* Fotoğraf zemini: köşelerde koyu vinyet, ortada hafif ışık */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,theme(colors.brand)/15,transparent_55%),radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.5))]"
      />

      {/* Belge: hafif yatık, gerçekçi gölge */}
      <div className="relative mx-auto w-full max-w-sm -rotate-1 rounded-[3px] bg-background shadow-[0_18px_40px_-12px_rgba(0,0,0,0.65)] ring-1 ring-black/30 transition-transform duration-500 sm:max-w-md">
        {/* Mavi çift çerçeve — gerçek belgenin guaj baskısının sade hali */}
        <div className="m-1.5 rounded-[2px] border-2 border-primary/70 p-[3px]">
          <div className="rounded-[1px] border border-primary/40 px-3 py-2.5 sm:px-4">
            {/* Başlık */}
            <div className="border-b border-primary/30 pb-1.5 text-center">
              <p className="text-[8px] font-bold tracking-[0.2em] text-primary-strong sm:text-[9px]">
                T.C.
              </p>
              <p className="text-[8px] font-bold tracking-wider text-foreground sm:text-[9px]">
                ARAÇ TESCİL BELGESİ
              </p>
            </div>

            {/* Alanlar: sol araç, sağ sahip — gerçek belgedeki kolon düzeni */}
            <div className="grid grid-cols-[1.25fr_1fr] gap-x-3 pt-2">
              <div className="space-y-[5px]">
                <DocField code="A" value="34 ABC 123" strong />
                <DocField code="B" value="A 1234567" />
                <DocField code="C.1" value="15.03.2019" />
                <DocField code="D.1" value="HONDA" />
                <DocField code="D.3" value="CIVIC 1.6 i-DTEC" />
                <DocField code="D.4" value="2018" />
                <DocField code="E" value="SHHFK2••••U201234" />
                <DocField code="P.3" value="DİZEL" />
                <DocField code="L" value="N16A1A•••••" />
              </div>
              <div className="space-y-[5px]">
                <DocField code="2.1" value="DEMO OTO SERVİS" />
                <DocField code="2.2" value="Şişli / İSTANBUL" />
                <DocField code="F.1" value="1730 kg" />
                <DocField code="G" value="1215 kg" />
                <DocField code="J" value="5 kişi" />
                <DocField code="O.1" value="BEYAZ" />
                {/* QR bloğu — gerçek belgedeki karekodun sade hali */}
                <div className="flex items-center gap-2 pt-0.5">
                  <QrMock />
                  <div className="min-w-0">
                    <p className="text-[7px] uppercase tracking-wider text-muted-foreground">
                      İ.R. No
                    </p>
                    <p className="truncate font-mono text-[8px] text-foreground">
                      TR·455088
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Kaşe + imza: belgenin alt sağında kırmızı yuvarlak kaşe */}
            <div className="relative mt-1 flex items-end justify-between border-t border-primary/20 pt-1.5">
              <p className="text-[7px] italic text-muted-foreground">
                Yolcu nakli + hususi
              </p>
              <div className="relative pr-1">
                <StampMock />
                {/* Üstüne binen imza kıvrımı */}
                <svg
                  aria-hidden
                  viewBox="0 0 90 24"
                  className="absolute -bottom-0.5 left-1 w-20 text-foreground/70"
                  fill="none"
                >
                  <path
                    d="M4 16 C 18 4, 30 22, 44 12 S 72 6, 86 14"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tarama çizgisi */}
      {phase === "scanning" && !prefersReducedMotion && (
        <div className="ruhsat-scan-line pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
      )}

      {/* Durum rozeti */}
      {phase !== "idle" && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold shadow-lg ${
              phase === "scanning"
                ? "bg-brand text-navy-foreground"
                : "bg-success text-success-foreground"
            }`}
          >
            <ScanLine className="size-3.5" />
            {phase === "scanning" ? "Okunuyor…" : "Okundu"}
          </span>
        </div>
      )}
    </div>
  );
}

/** Belge içindeki tek alan satırı: kod + (el yazısı hissi veren) değer. */
function DocField({
  code,
  value,
  strong = false,
}: {
  code: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-dotted border-muted-foreground/25 pb-[2px]">
      <p className="text-[6.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[7px]">
        {code}
      </p>
      <p
        className={`truncate font-mono text-foreground ${
          strong ? "text-[10px] font-bold tracking-wide sm:text-[11px]" : "text-[8px] sm:text-[8.5px]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** Kırmızı yuvarlak kaşe — gerçek belgedeki daire kaşenin sade hali. */
function StampMock() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      className="w-12 rotate-[-12deg] text-destructive-strong sm:w-14"
      fill="none"
    >
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="32" r="21" stroke="currentColor" strokeWidth="1" />
      <defs>
        <path id="stamp-arc-top" d="M 11 32 A 21 21 0 0 1 53 32" />
        <path id="stamp-arc-bottom" d="M 13 32 A 19 19 0 0 0 51 32" />
      </defs>
      <text fontSize="7.5" fontWeight="700" fill="currentColor" letterSpacing="1.5">
        <textPath href="#stamp-arc-top" startOffset="50%" textAnchor="middle">
          BAKIMX
        </textPath>
      </text>
      <text fontSize="6" fontWeight="600" fill="currentColor" letterSpacing="1">
        <textPath href="#stamp-arc-bottom" startOffset="50%" textAnchor="middle">
          ÖRNEKTİR
        </textPath>
      </text>
      <text
        x="32"
        y="35"
        fontSize="9"
        fontWeight="800"
        fill="currentColor"
        textAnchor="middle"
      >
        2019
      </text>
    </svg>
  );
}

/** Karekod bloğu — deterministik desen; gerçek veri taşımaz. */
function QrMock() {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className="size-8 shrink-0 text-foreground" fill="currentColor">
      {/* Konum belirteçleri */}
      <path d="M0 0h7v7H0zM2 2h3v3H2zM14 0h7v7h-7zM16 2h3v3h-3zM0 14h7v7H0zM2 16h3v3H2z" />
      {/* Veri modülleri (sabit desen) */}
      {[
        [9, 0], [11, 1], [9, 2], [12, 2], [10, 3], [12, 4], [9, 5], [11, 5],
        [9, 7], [10, 8], [12, 8], [8, 9], [11, 9], [13, 9], [9, 10], [12, 11],
        [10, 12], [13, 12], [8, 13], [11, 13], [9, 14], [12, 14], [10, 16],
        [12, 16], [8, 17], [11, 17], [13, 17], [9, 18], [12, 19], [10, 20],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
      ))}
    </svg>
  );
}

/** Sağdaki okunan alan hücresi (görünme animasyonu + düşük-güven vurgusu). */
function FieldCell({
  field,
  shown,
}: {
  field: Field;
  shown: boolean;
}) {
  return (
    <div
      style={{ opacity: shown ? 1 : 0.35 }}
      className={`rounded-lg border px-3 py-2 transition-opacity duration-[250ms] ${
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
          <span
            style={{ "--enter-from": "0.25rem", "--enter-duration": "0.2s" } as CSSProperties}
            className="enter-up truncate font-mono text-sm font-medium"
          >
            {field.value}
          </span>
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
    </div>
  );
}
