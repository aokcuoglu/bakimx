"use client"

export function PrintButton({ className, label }: { className?: string; label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className={className ?? "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors print:hidden"}
    >
      {label ?? "Yazdır"}
    </button>
  )
}