"use client";

import Image from "next/image";
import { CheckCircle2, MessageSquareQuote } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  LANDING_OBJECTIONS,
  type LandingObjection,
} from "@/lib/landing/objections";

type ObjectionCardsProps = {
  /**
   * Faz 3 (BAK-81) entegrasyon noktası.
   *
   * Verilmezse kart normal bir link gibi davranır ve SSS'teki karşılığına gider
   * — JS olmadan da çalışan yol budur. Faz 3 ask bar'ı eklediğinde buraya
   * "ask bar'ı bu soruyla doldur" geçilir; link `href` olarak yerinde kalır,
   * yalnız tıklama davranışı devralınır.
   */
  onSelect?: (objection: LandingObjection) => void;
  className?: string;
};

/**
 * Hero'nun sağ kolonundaki soru→cevap kart şeridi.
 *
 * Düzenin tamamı `globals.css`teki `.objection-strip` / `.objection-track`
 * kurallarında: mobilde yatay snap, desktop'ta sonsuz dikey kayma, hareket
 * azaltma tercihinde statik grid. Burada JS ile kırılım ölçülmez — DOM her
 * durumda aynıdır, dolayısıyla sunucu çıktısıyla istemci render'ı ayrışmaz.
 *
 * Sonsuz döngü için liste iki kez basılır. İkinci set yalnız görsel bir
 * devamlılık hilesidir: ekran okuyucuya `aria-hidden`, klavyeye kapalı.
 */
export function ObjectionCards({ onSelect, className }: ObjectionCardsProps) {
  return (
    <div className={cn("objection-strip", className)}>
      <ul
        className="objection-track"
        aria-label="Atölyelerin en sık dile getirdiği sorunlar ve BakimX'in cevabı"
      >
        {LANDING_OBJECTIONS.map((objection) => (
          <ObjectionCard
            key={objection.id}
            objection={objection}
            onSelect={onSelect}
          />
        ))}
        {LANDING_OBJECTIONS.map((objection) => (
          <ObjectionCard
            key={`clone-${objection.id}`}
            objection={objection}
            onSelect={onSelect}
            clone
          />
        ))}
      </ul>
    </div>
  );
}

function ObjectionCard({
  objection,
  onSelect,
  clone = false,
}: {
  objection: LandingObjection;
  onSelect?: (objection: LandingObjection) => void;
  clone?: boolean;
}) {
  return (
    <li
      // CSS bu işareti görüp kopyayı mobilde ve hareket azaltmada düzenden çıkarır.
      data-objection-clone={clone ? "" : undefined}
      aria-hidden={clone || undefined}
      className="mx-auto w-full lg:max-w-96"
    >
      <a
        href={objection.href}
        // Kopya ne okunur ne de sekme sırasına girer; aksi halde aynı 8 kart
        // ekran okuyucuda ve klavyede iki kez dolaşılırdı.
        tabIndex={clone ? -1 : undefined}
        onClick={
          onSelect
            ? (event) => {
                event.preventDefault();
                onSelect(objection);
              }
            : undefined
        }
        className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
      >
        <p className="flex items-start gap-2 text-sm font-semibold text-navy dark:text-foreground">
          <MessageSquareQuote
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <span>&ldquo;{objection.question}&rdquo;</span>
        </p>

        <Separator className="my-3" />

        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <CheckCircle2
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-success-strong"
          />
          <span>{objection.answer}</span>
        </p>

        <Image
          src={objection.screenshot}
          alt={objection.screenshotAlt}
          // Dosyaların gerçek ölçüsü — hepsi aynı (880x550 CSS kırpım @2x).
          width={1760}
          height={1100}
          // Hero'nun LCP'si artık H1 metni. Bu görseller `priority` ALMAZ ve
          // tembel yüklenir; şeride ilk giren kart bile ilk boyayı geciktirmez.
          loading="lazy"
          sizes="(min-width: 1024px) 384px, 80vw"
          className="mt-3 w-full rounded-lg border bg-muted"
        />
      </a>
    </li>
  );
}
