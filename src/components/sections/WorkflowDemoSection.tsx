"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardList,
  Filter,
  PackageSearch,
  ScanLine,
} from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import styles from "./workflow-demo.module.css";

type StepId = "ruhsat" | "order" | "parts" | "select";

const STEPS: {
  id: StepId;
  title: string;
  hint: string;
  icon: typeof ScanLine;
}[] = [
  {
    id: "ruhsat",
    title: "Ruhsat okut",
    hint: "Fotoğraftan araç bilgileri · otomatik doldurma",
    icon: ScanLine,
  },
  {
    id: "order",
    title: "İş emri oluştur",
    hint: "Müşteri + araç + şikayet tek ekranda",
    icon: ClipboardList,
  },
  {
    id: "parts",
    title: "Araca özel parça listesi",
    hint: "Uyumluluk filtresi · stok görünümü",
    icon: PackageSearch,
  },
  {
    id: "select",
    title: "Hava filtresi seç",
    hint: "Tek tıkla iş emrine ekle",
    icon: Filter,
  },
];

/** RuhsatDemoSection ile aynı örnek belge — tutarlı tanıtım verisi. */
const RUHSAT_FIELDS = [
  { label: "Plaka", code: "A", value: "34 LKN 123" },
  { label: "Marka", code: "D.1", value: "HONDA" },
  { label: "Model", code: "D.3", value: "PCX 125" },
  { label: "Model yılı", code: "D.4", value: "2024" },
  { label: "Şase no", code: "E", value: "RLHJK05A8RY123456" },
  { label: "Renk", code: "R", value: "Beyaz" },
];

const ORDER_FIELDS = [
  { label: "Plaka", value: "34 LKN 123" },
  { label: "Araç", value: "2024 · Honda PCX 125" },
  { label: "Müşteri", value: "Ayşe Yılmaz" },
  { label: "Şikayet", value: "Periyodik bakım + filtre" },
];

const PARTS = [
  { name: "Hava filtresi", sku: "FA-PCX-125 · Mann", price: "₺285", selected: true },
  { name: "Yağ filtresi", sku: "OF-PCX-125 · Bosch", price: "₺190", selected: false },
  { name: "Buji", sku: "SP-PCX-125 · NGK", price: "₺220", selected: false },
  { name: "Varyatör kayışı", sku: "VB-PCX-125 · Gates", price: "₺890", selected: false },
];

const STEP_DWELL_MS = 2600;

/** ProductStage penceresine gömülen canlı akış paneli. */
export function WorkflowDemoPanel({ compact = false }: { compact?: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion) return;

    const dwell = activeIndex === STEPS.length - 1 ? STEP_DWELL_MS + 900 : STEP_DWELL_MS;
    const timer = setTimeout(() => {
      setActiveIndex((index) => (index + 1) % STEPS.length);
    }, dwell);

    return () => clearTimeout(timer);
  }, [activeIndex, prefersReducedMotion]);

  const displayIndex = prefersReducedMotion ? STEPS.length - 1 : activeIndex;

  return (
    <div className={compact ? styles.panelCompact : styles.panelEmbedded}>
      <div className={styles.panelHeader}>
        <span className={styles.liveDot} aria-hidden />
        <h3 className={styles.panelTitle}>BakımX · canlı akış</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Demo
        </span>
      </div>

      <div className={styles.panelBody}>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => {
            const done = index < displayIndex;
            const active = index === displayIndex;
            const open = active;
            const Icon = step.icon;

            return (
              <li
                key={step.id}
                className={[
                  styles.step,
                  active ? styles.stepActive : "",
                  done ? styles.stepDone : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.stepHeader}>
                  <span className={styles.stepIndex} aria-hidden>
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <div className={styles.stepLabel}>
                    <p className={styles.stepTitle}>
                      <Icon
                        className="mr-1.5 inline size-3.5 text-muted-foreground"
                        aria-hidden
                      />
                      {step.title}
                    </p>
                    <p className={styles.stepHint}>{step.hint}</p>
                  </div>
                  {done && (
                    <CheckCircle2
                      className="size-4 text-success-strong"
                      aria-label="Tamamlandı"
                    />
                  )}
                </div>

                <div className={styles.stepDetail} data-open={open ? "true" : "false"}>
                  {step.id === "ruhsat" && (
                    <RuhsatDetail
                      scanning={active && !done && !prefersReducedMotion}
                      prefersReducedMotion={!!prefersReducedMotion}
                    />
                  )}
                  {step.id === "order" && <OrderDetail />}
                  {step.id === "parts" && <PartsDetail highlightSelected={false} />}
                  {step.id === "select" && <PartsDetail highlightSelected />}
                </div>
              </li>
            );
          })}
        </ol>


      </div>
    </div>
  );
}

/** Image #3 ruhsat demosunun kompakt hali — belge + okunan alanlar. */
function RuhsatDetail({
  scanning,
  prefersReducedMotion,
}: {
  scanning: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <div className={styles.ruhsatLayout}>
      <div className={styles.ruhsatDoc}>
        <Image
          src="/landing/ruhsat-demo.png"
          alt="34 LKN 123 plakalı, 2024 model Honda PCX 125 ruhsat fotoğrafı"
          width={721}
          height={1024}
          sizes="(min-width: 640px) 240px, calc(100vw - 96px)"
          className={styles.ruhsatImage}
        />
        {scanning && !prefersReducedMotion && (
          <div
            aria-hidden
            className="ruhsat-scan-line pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-primary/35 to-transparent"
          />
        )}
        <span
          className={`${styles.ruhsatBadge} ${
            scanning ? styles.ruhsatBadgeScan : styles.ruhsatBadgeDone
          }`}
        >
          <ScanLine className="size-3" />
          {scanning ? "Okunuyor…" : "Okundu"}
        </span>
      </div>

      <div className={styles.fieldRow}>
        <p className={styles.ruhsatFieldsTitle}>Okunan bilgiler</p>
        {RUHSAT_FIELDS.map((f) => (
          <div key={f.code} className={styles.field}>
            <span className={styles.fieldLabel}>
              {f.label}{" "}
              <span className="text-[10px] text-muted-foreground">({f.code})</span>
            </span>
            <span className={styles.fieldValue}>{f.value}</span>
            <Check className={`size-3.5 ${styles.fieldCheck}`} aria-hidden />
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderDetail() {
  return (
    <div className={styles.fieldRow}>
      {ORDER_FIELDS.map((f) => (
        <div key={f.label} className={styles.field}>
          <span className={styles.fieldLabel}>{f.label}</span>
          <span className={styles.fieldValue}>{f.value}</span>
          <Check className={`size-3.5 ${styles.fieldCheck}`} aria-hidden />
        </div>
      ))}
      <p className="pt-1 text-[11px] font-medium text-success-strong">
        İş emri #IE-2847 oluşturuldu
      </p>
    </div>
  );
}

function PartsDetail({ highlightSelected }: { highlightSelected: boolean }) {
  return (
    <div className={styles.partsList}>
      {PARTS.map((part) => {
        const selected = highlightSelected && part.selected;
        return (
          <div
            key={part.sku}
            className={`${styles.partRow} ${selected ? styles.partRowSelected : ""}`}
          >
            <span className={styles.partThumb} aria-hidden>
              <Filter className="size-3.5" />
            </span>
            <div className={styles.partMeta}>
              <p className={styles.partName}>{part.name}</p>
              <p className={styles.partSku}>{part.sku}</p>
            </div>
            <span className={styles.partPrice}>{part.price}</span>
            {selected && (
              <Check className={`size-3.5 ${styles.fieldCheck}`} aria-label="Seçildi" />
            )}
          </div>
        );
      })}
    </div>
  );
}
