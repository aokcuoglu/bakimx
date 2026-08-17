"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LANDING_OBJECTIONS } from "@/lib/landing/objections";
import {
  getAssistantBridge,
  getServerAssistantBridge,
  requestAssistantAnswers,
  setAskBarVisible,
  subscribeAssistantBridge,
} from "@/components/site-assistant/assistant-bridge";
import { ASSISTANT_PANEL_ID } from "@/components/site-assistant/assistant-panel";

/**
 * Çipler Faz 2'deki kartların ilk dört sorusudur; metin `objections.ts`ten
 * gelir, burada kopyası tutulmaz.
 */
const CHIP_COUNT = 4;
const CHIPS = LANDING_OBJECTIONS.slice(0, CHIP_COUNT);

const INPUT_ID = "hero-ask-bar";

interface HeroAskBarProps {
  value: string;
  onValueChange: (value: string) => void;
  /**
   * İtiraz kartına tıklanınca artan sayaç: ask bar dolduğunda odağı da alır,
   * yoksa ekranın öbür ucunda sessizce değişen bir kutu kalırdı.
   */
  focusSignal: number;
}

/**
 * Hero'nun altındaki "BakımX'e sorun" satırı (BAK-81).
 *
 * Kendi asistanı yoktur: yazılan soru köprüye bırakılır, `layout.tsx`teki
 * mevcut `SiteAssistant` paneli açıp cevabı gösterir. Akış içinde durur —
 * `fixed`/`sticky` bir CTA değildir.
 */
export function HeroAskBar({ value, onValueChange, focusSignal }: HeroAskBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelOpen = useSyncExternalStore(
    subscribeAssistantBridge,
    () => getAssistantBridge().panelOpen,
    () => getServerAssistantBridge().panelOpen,
  );

  // Ask bar ekrandayken sağ-alt FAB gizlenir; hero yukarı kayınca geri gelir.
  // İki asistan girişi aynı anda durmaz.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      // Gözlemci yoksa FAB'ı gizleme — kullanıcıyı asistansız bırakmaktansa
      // iki giriş göstermek daha az kötü.
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setAskBarVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      setAskBarVisible(false);
    };
  }, []);

  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  function ask(question: string) {
    onValueChange(question);
    requestAssistantAnswers(question);
  }

  return (
    <div ref={wrapperRef} className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(value);
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Label htmlFor={INPUT_ID} className="sr-only">
          BakımX&apos;e sorunuzu yazın
        </Label>
        <div className="relative flex-1">
          <MessageCircleQuestion
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={INPUT_ID}
            ref={inputRef}
            role="combobox"
            aria-haspopup="dialog"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            // Vaat ettiğimiz şey hazır yanıtları bulmak; "her şeyi sorun" değil.
            placeholder="Sorunuzu yazın, yanıtını bulalım"
            autoComplete="off"
            aria-expanded={panelOpen}
            // Panel kapalıyken o `id` DOM'da yok; var olmayan bir düğüme
            // işaret eden `aria-controls` ekran okuyucuda kırık referanstır.
            aria-controls={panelOpen ? ASSISTANT_PANEL_ID : undefined}
            className="h-12 rounded-full pl-9 pr-4 shadow-sm md:h-12"
          />
        </div>
        <Button type="submit" size="lg" disabled={value.trim().length === 0} className="gap-2 rounded-full px-6">
          Sor
          <ArrowRight aria-hidden className="size-4" />
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Sık sorulan sorular" role="group">
        {CHIPS.map((objection) => (
          <Button
            key={objection.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ask(objection.question)}
            className="h-auto whitespace-normal rounded-full px-3 py-1.5 text-left text-xs font-normal text-muted-foreground md:h-auto"
          >
            {objection.question}
          </Button>
        ))}
      </div>
    </div>
  );
}
