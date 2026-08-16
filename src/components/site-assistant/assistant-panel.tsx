"use client";

import { useEffect } from "react";
import { X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssistantView, SuccessContext } from "./site-assistant";
import { MenuView } from "./views/menu-view";
import { LiveChatView } from "./views/live-chat-view";
import { DemoFormView } from "./views/demo-form-view";
import { SupportFormView } from "./views/support-form-view";
import { FaqView } from "./views/faq-view";
import { SuccessView } from "./views/success-view";

interface AssistantPanelProps {
  view: AssistantView;
  successContext: SuccessContext;
  onNavigate: (view: AssistantView) => void;
  onSuccess: (context: SuccessContext) => void;
  onClose: () => void;
}

export function AssistantPanel({ view, successContext, onNavigate, onSuccess, onClose }: AssistantPanelProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="BakımX Asistanı"
      aria-modal="false"
      className={cn(
        "fixed z-40 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
        "bottom-20 left-4 right-4 max-h-[70vh]",
        "sm:bottom-24 sm:left-auto sm:right-6 sm:w-[380px] sm:max-h-[560px]",
        // Sohbette yükseklik sabitlenir: mesaj listesi kendi içinde kayar,
        // panel her yeni mesajda büyüyüp zıplamaz.
        view === "chat" && "h-[70vh] sm:h-[560px]",
      )}
    >
      <header className="flex items-center gap-3 bg-primary px-4 py-3.5 text-primary-foreground">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Wrench className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold leading-tight">BakımX Asistanı</p>
          <p className="text-xs leading-tight text-primary-foreground/80">
            Sorularınız için buradayız
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Kapat"
          className="-mr-1 shrink-0 rounded-full text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className={cn("min-h-0 flex-1", view === "chat" ? "flex flex-col" : "overflow-y-auto")}>
        {view === "menu" && <MenuView onNavigate={onNavigate} />}
        {view === "chat" && <LiveChatView onBack={() => onNavigate("menu")} />}
        {view === "demo" && <DemoFormView onBack={() => onNavigate("menu")} onSuccess={onSuccess} />}
        {view === "support" && <SupportFormView onBack={() => onNavigate("menu")} onSuccess={onSuccess} />}
        {view === "faq" && <FaqView onBack={() => onNavigate("menu")} />}
        {view === "success" && (
          <SuccessView context={successContext} onReset={() => onNavigate("menu")} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
