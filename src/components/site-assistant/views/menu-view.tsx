"use client";

import { CalendarCheck, ShoppingCart, LifeBuoy, HelpCircle, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const ACTIONS: MenuAction[] = [
  { key: "demo", label: "Demo talep et", description: "Size özel canlı tanıtım ayarlayalım", icon: CalendarCheck, view: "demo" },
  { key: "buy", label: "Satın al / Fiyatlar", description: "Anında 7 gün ücretsiz deneyin", icon: ShoppingCart, href: "/satin-al" },
  { key: "support", label: "Destek / İletişim", description: "Sorunuzu ekibimize iletelim", icon: LifeBuoy, view: "support" },
  { key: "faq", label: "Sık Sorulanlar", description: "En çok merak edilenler", icon: HelpCircle, view: "faq" },
];

function ActionInner({ action }: { action: MenuAction }) {
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
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );
}

const ROW_CLASS =
  "h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left";

export function MenuView({ onNavigate }: MenuViewProps) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl bg-muted/60 px-4 py-3">
        <p className="text-sm text-foreground">
          Merhaba! 👋 BakımX ile ilgilendiğiniz için teşekkürler. Size nasıl yardımcı olabiliriz?
        </p>
      </div>
      <div className="space-y-2">
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
