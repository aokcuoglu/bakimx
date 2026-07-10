"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SuccessContext } from "../site-assistant";

interface SuccessViewProps {
  context: SuccessContext;
  onReset: () => void;
  onClose: () => void;
}

const MESSAGES: Record<SuccessContext, { title: string; body: string }> = {
  demo: {
    title: "Demo talebiniz alındı!",
    body: "En kısa sürede sizinle iletişime geçeceğiz. İlginiz için teşekkürler.",
  },
  support: {
    title: "Talebiniz alındı!",
    body: "Ekibimiz en kısa sürede size dönecek. İlginiz için teşekkürler.",
  },
};

export function SuccessView({ context, onReset, onClose }: SuccessViewProps) {
  const m = MESSAGES[context];
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-6 w-6 text-success" />
      </span>
      <p className="text-base font-semibold text-foreground">{m.title}</p>
      <p className="text-sm text-muted-foreground">{m.body}</p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          Başka bir şey sor
        </Button>
        <Button type="button" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </div>
  );
}
