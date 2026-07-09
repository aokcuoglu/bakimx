"use client"

import { useCallback, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Loader2, Tag } from "lucide-react"
import type { CategoryNode } from "@/lib/tecdoc/types"
import { cn } from "@/lib/utils"

export function ItemCategoryCascade({
  vehicleTypeId,
  value,
  onSelect,
}: {
  vehicleTypeId: number | null
  value: string | null
  onSelect: (sel: { category: string; categoryId: number | null }) => void
}) {
  // Araç TecDoc'ta eşleşmemiş → serbest metin fallback.
  const [freeText, setFreeText] = useState(value || "")
  if (vehicleTypeId == null) {
    return (
      <Input
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        onBlur={() => {
          if (freeText !== (value || "")) onSelect({ category: freeText, categoryId: null })
        }}
        placeholder="Kategori (serbest)"
        className="h-8 text-xs w-40"
      />
    )
  }
  return <CascadePopover vehicleTypeId={vehicleTypeId} value={value} onSelect={onSelect} />
}

function CascadePopover({
  vehicleTypeId,
  value,
  onSelect,
}: {
  vehicleTypeId: number
  value: string | null
  onSelect: (sel: { category: string; categoryId: number | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const [tree, setTree] = useState<CategoryNode[] | null>(null)
  const [stack, setStack] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/tecdoc/categories?vehicleId=${vehicleTypeId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Katalog yüklenemedi.")
      setTree(data.categories as CategoryNode[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Katalog yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [vehicleTypeId])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && tree == null) void load()
    if (!next) setStack([])
  }

  const currentNodes = stack.length === 0 ? tree ?? [] : stack[stack.length - 1].children

  function pick(node: CategoryNode) {
    if (node.children.length > 0) {
      // Alt kategorisi var → cascade: içine in (next).
      setStack((s) => [...s, node])
    } else {
      // Yaprak → seç ve kapat.
      onSelect({ category: node.name, categoryId: node.id })
      setOpen(false)
      setStack([])
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-muted transition-colors max-w-40"
          />
        }
      >
        <Tag className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{value || "Kategori"}</span>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          {stack.length > 0 && (
            <button
              type="button"
              onClick={() => setStack((s) => s.slice(0, -1))}
              className="p-1 rounded hover:bg-muted"
              aria-label="Geri"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <span className="text-xs font-medium text-muted-foreground truncate">
            {stack.length === 0 ? "Kategori seç" : stack[stack.length - 1].name}
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && <div className="px-3 py-2 text-xs text-destructive">{error}</div>}
          {!loading &&
            !error &&
            currentNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => pick(node)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b border-border last:border-0"
                )}
              >
                <span className="truncate">{node.name}</span>
                {node.children.length > 0 && (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))}
          {!loading && !error && currentNodes.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Alt kategori yok</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
