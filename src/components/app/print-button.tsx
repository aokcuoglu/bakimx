"use client"

import { Button } from "@/components/ui/button"

export function PrintButton({ className, label }: { className?: string; label?: string }) {
  return (
    <Button
      variant="outline"
      onClick={() => window.print()}
      className={className ?? "print:hidden"}
    >
      {label ?? "Yazdır"}
    </Button>
  )
}