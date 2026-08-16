"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, ShoppingCart, LifeBuoy, HelpCircle, ChevronRight, MessagesSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssistantView } from "../site-assistant";

interface MenuViewProps {
  onNavigate: (view: AssistantView) => void;
}

interface MenuAction {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  view?: Exclude<AssistantView, "menu" | "success">;
  href?: string;
}

const LIVE_CHAT_ACTION: MenuAction = {
  key: "chat",
  label: "Canlı destek",
  description: "Ekibimizle şimdi yazışın",
  icon: MessagesSquare,
  view: "chat",
};

const ACTIONS: MenuAction[] = [
  { key: "demo", label: "Demo talep et", description: "Size özel canlı tanıtım ayarlayalım", icon: CalendarCheck, view: "demo" },
  { key: "buy", label: "Satın al / Fiyatlar", description: "Anında 7 gün ücretsiz deneyin", icon: ShoppingCart, href: "/satin-al" },
  { key: "support", label: "Destek / İletişim", description: "Sorunuzu ekibimize iletelim", icon: LifeBuoy, view: "support" },
  { key: "faq", label: "Sık Sorulanlar", description: "En çok merak edilenler", icon: HelpCircle, view: "faq" },
];

function ActionInner({ action, trailing }: { action: MenuAction; trailing?: React.ReactNode }) {
  const Icon = action.icon;
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{action.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
      </span>
      {trailing}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );
}

const ROW_CLASS =
  "h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left";

/** Menüdeki canlı destek satırının çevrimiçi rozetini besleyen minimum sorgu. */
function useLiveChatBadge() {
  const [state, setState] = useState<{ available: boolean; online: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/live-chat/status")
      .then((res) => res.json())
      .then((data: { available?: boolean; online?: boolean }) => {
        if (!cancelled) setState({ available: data.available === true, online: data.online === true });
      })
      .catch(() => {
        // Durum alınamazsa satırı hiç gösterme — "çevrimiçi" yalanı söylemektense yok say.
        if (!cancelled) setState({ available: false, online: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function MenuView({ onNavigate }: MenuViewProps) {
  const badge = useLiveChatBadge();

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl bg-muted/60 px-4 py-3">
        <p className="text-sm text-foreground">
          Merhaba! 👋 BakımX ile ilgilendiğiniz için teşekkürler. Size nasıl yardımcı olabiliriz?
        </p>
      </div>
      <div className="space-y-2">
        {badge?.available && (
          <Button
            type="button"
            variant="outline"
            className={ROW_CLASS}
            onClick={() => onNavigate("chat")}
          >
            <ActionInner
              action={LIVE_CHAT_ACTION}
              trailing={
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    badge.online ? "bg-success/15 text-success-strong" : "bg-muted text-muted-foreground",
                  )}
                >
                  {badge.online ? "Çevrimiçi" : "Çevrimdışı"}
                </span>
              }
            />
          </Button>
        )}
        {ACTIONS.map((action) =>
          action.href ? (
            <Button
              key={action.key}
              variant="outline"
              className={ROW_CLASS}
              nativeButton={false}
              render={
                <a href={action.href}>
                  <ActionInner action={action} />
                </a>
              }
            />
          ) : (
            <Button
              key={action.key}
              type="button"
              variant="outline"
              className={ROW_CLASS}
              onClick={() => action.view && onNavigate(action.view)}
            >
              <ActionInner action={action} />
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
