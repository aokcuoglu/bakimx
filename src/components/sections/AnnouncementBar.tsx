"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ANNOUNCEMENT_BAR_SLOT,
  ANNOUNCEMENT_STORAGE_KEY,
  landingAnnouncement,
} from "@/lib/landing/announcement";

/**
 * Duyuru barı — rozet + metin + ok'lu CTA, kapatılabilir.
 *
 * CLS notu: bar HER ZAMAN sunucudan gelir. Kapatmış ziyaretçide satır içi
 * script kök layout'tan hidrasyondan önce çalışır, yani bar hiç boyanmaz ve
 * aşağıdaki efekt onu kaldırdığında görsel bir zıplama olmaz.
 * Header `sticky top-0` olduğu için konumu barın varlığına bağlı değildir.
 */
export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) === landingAnnouncement.id) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDismissed(true);
      }
    } catch {
      /* localStorage erişilemezse duyuru görünür kalsın */
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, landingAnnouncement.id);
    } catch {
      /* yok say — kapatma yalnız bu oturum için geçerli olur */
    }
    setDismissed(true);
  }

  if (dismissed) {
    return null;
  }

  return (
    <div
      data-slot={ANNOUNCEMENT_BAR_SLOT}
      style={{ "--enter-from": "-0.5rem", "--enter-duration": "0.4s" } as CSSProperties}
      className="enter-up bg-primary text-primary-foreground"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-9 flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1.5 pr-10 text-center text-xs sm:text-sm">
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            {landingAnnouncement.badge}
          </span>
          <span>{landingAnnouncement.text}</span>
          <Link
            href={landingAnnouncement.href}
            className="inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-4 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 focus-visible:ring-offset-1 focus-visible:ring-offset-primary rounded-sm"
          >
            {landingAnnouncement.linkLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Button
          variant="ghost"
          size="icon-compact"
          onClick={dismiss}
          aria-label="Duyuruyu kapat"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:ring-primary-foreground/70 dark:hover:bg-primary-foreground/15"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
