"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ViewHeaderProps {
  title: string;
  onBack: () => void;
}

export function ViewHeader({ title, onBack }: ViewHeaderProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-1.5 gap-1 px-2 text-xs text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" /> Geri
      </Button>
      <span className="text-sm font-medium text-foreground">{title}</span>
    </div>
  );
}
