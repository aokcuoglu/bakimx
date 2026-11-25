"use client";

import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssistantLauncherProps {
  open: boolean;
  onClick: () => void;
}

export function AssistantLauncher({ open, onClick }: AssistantLauncherProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={open ? "Asistanı kapat" : "BakımX Asistanı'nı aç"}
      aria-expanded={open}
      variant="navy"
      size="icon-lg"
      className={cn(
        "fixed bottom-4 right-4 z-40 shadow-md",
        "transition-transform hover:scale-105 active:scale-95",
        "[&_svg:not([class*='size-'])]:size-5 sm:bottom-6 sm:right-6",
      )}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {open ? <X /> : <MessageCircle />}
    </Button>
  );
}
