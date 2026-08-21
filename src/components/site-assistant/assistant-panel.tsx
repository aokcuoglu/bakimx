"use client";

import { useEffect, useRef } from "react";
import { X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssistantView, SuccessContext } from "./site-assistant";
import { MenuView } from "./views/menu-view";
import { LiveChatView } from "./views/live-chat-view";
import { DemoFormView } from "./views/demo-form-view";
import { SupportFormView } from "./views/support-form-view";
import { FaqView } from "./views/faq-view";
import { AnswersView } from "./views/answers-view";
import { SuccessView } from "./views/success-view";
import { ASSISTANT_PANEL_ID } from "./assistant-bridge";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface AssistantPanelProps {
  view: AssistantView;
  successContext: SuccessContext;
  /** Ask bar'dan gelen soru; yalnız `view === "answers"` iken anlamlı. */
  query: string;
  aiEnabled: boolean;
  /**
   * Ask bar'dan açıldığında panel gerçek bir iletişim kutusu gibi davranır:
   * odak içeride hapsolur, kapanınca ask bar'a geri döner. FAB'dan açılan
   * panel eskisi gibi modal DEĞİLDİR — kullanıcı sayfayı gezmeye devam eder.
   */
  modal?: boolean;
  onNavigate: (view: AssistantView) => void;
  onSuccess: (context: SuccessContext) => void;
  onClose: () => void;
}

export function AssistantPanel({
  view,
  successContext,
  query,
  aiEnabled,
  modal = false,
  onNavigate,
  onSuccess,
  onClose,
}: AssistantPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Odak tuzağı yalnız modal açılışta. Kapanışta odak paneli açan öğeye
  // (ask bar input'u) geri verilir.
  useEffect(() => {
    const node = panelRef.current;
    if (!modal || !node) return;

    const opener = document.activeElement as HTMLElement | null;
    node.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      opener?.focus?.({ preventScroll: true });
    };
  }, [modal]);

  return (
    <>
      {/* Modal açılışta arkaplan: paneli kapatır ve modalliği görünür kılar.
          Sayfa kaydırması KİLİTLENMEZ — kaydırma çubuğunu kaldırmak düzeni
          kaydırır ve tam da kaçındığımız zıplamayı yaratırdı. */}
      {modal && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[1px] motion-safe:animate-in motion-safe:fade-in"
        />
      )}
      <div
        id={ASSISTANT_PANEL_ID}
        ref={panelRef}
        role="dialog"
        aria-label="BakımX Asistanı"
        aria-modal={modal}
        tabIndex={-1}
        className={cn(
          "fixed z-40 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl outline-none",
          "bottom-20 left-4 right-4 max-h-[70vh]",
          "sm:bottom-24 sm:left-auto sm:right-6 sm:w-[380px] sm:max-h-[560px]",
          // Sohbette yükseklik sabitlenir: mesaj listesi kendi içinde kayar,
          // panel her yeni mesajda büyüyüp zıplamaz.
          view === "chat" && "h-[70vh] sm:h-[560px]",
          // FAB gizliyken panel dibe daha yakın durabilir; ask bar'dan açılan
          // panelin altında bir düğme beklemiyoruz.
          modal && "bottom-4 sm:bottom-6",
        )}
      >
        <div className="flex items-center gap-3 bg-primary px-4 py-3.5 text-primary-foreground">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Wrench className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-semibold leading-tight">BakımX Asistanı</p>
            <p className="text-xs leading-tight text-primary-foreground">
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
        </div>

        <div className={cn("min-h-0 flex-1", view === "chat" ? "flex flex-col" : "overflow-y-auto")}>
          {view === "menu" && <MenuView onNavigate={onNavigate} />}
          {view === "answers" && (
            <AnswersView query={query} aiEnabled={aiEnabled} onBack={() => onNavigate("menu")} onNavigate={onNavigate} />
          )}
          {view === "chat" && <LiveChatView onBack={() => onNavigate("menu")} />}
          {view === "demo" && <DemoFormView onBack={() => onNavigate("menu")} onSuccess={onSuccess} />}
          {view === "support" && <SupportFormView onBack={() => onNavigate("menu")} onSuccess={onSuccess} />}
          {view === "faq" && <FaqView onBack={() => onNavigate("menu")} />}
          {view === "success" && (
            <SuccessView context={successContext} onReset={() => onNavigate("menu")} onClose={onClose} />
          )}
        </div>
      </div>
    </>
  );
}
