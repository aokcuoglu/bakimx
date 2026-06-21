"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
  Shield,
  ClipboardList,
  Wrench,
  Package,
  FileText,
  StickyNote,
} from "lucide-react"
import { cn } from "@/lib/utils"

type AdvisorResult = {
  suggestedInspections: string[]
  suggestedLabor: string[]
  suggestedParts: string[]
  customerDescription: string
  internalNote: string
  missingInfoWarnings: string[]
  provider: string
}

type AdvisorItem = {
  type: "inspection" | "labor" | "part"
  label: string
  selected: boolean
  edited: boolean
}

export function ServiceAdvisorPanel({
  intakeFormId,
  customerComplaint,
  vehicleBrand,
  vehicleModel,
  mileage,
  onAddItems,
}: {
  intakeFormId: string
  customerComplaint: string
  vehicleBrand: string
  vehicleModel: string
  mileage: number | null
  onAddItems: (items: Array<{ type: "labor" | "part"; name: string }>, customerDescription: string, internalNote: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<AdvisorResult | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [items, setItems] = useState<AdvisorItem[]>([])
  const [editMode, setEditMode] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [addingCustom, setAddingCustom] = useState<"labor" | "part" | null>(null)
  const [customName, setCustomName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function fetchAdvice() {
    setLoading(true)
    setError("")
    setResult(null)
    setItems([])
    try {
      const res = await fetch("/api/orders/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeFormId,
          complaint: customerComplaint,
          vehicleBrand,
          vehicleModel,
          mileage,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      const r: AdvisorResult = data.result
      setResult(r)

      const allItems: AdvisorItem[] = [
        ...r.suggestedInspections.map((label) => ({ type: "inspection" as const, label, selected: false, edited: false })),
        ...r.suggestedLabor.map((label) => ({ type: "labor" as const, label, selected: true, edited: false })),
        ...r.suggestedParts.map((label) => ({ type: "part" as const, label, selected: true, edited: false })),
      ]
      setItems(allItems)
    } catch {
      setError("AI danışman bağlantı hatası")
    } finally {
      setLoading(false)
    }
  }

  function toggleItem(index: number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item)))
  }

  function startEdit(index: number) {
    setEditMode(String(index))
    setEditValue(items[index].label)
  }

  function saveEdit(index: number) {
    if (!editValue.trim()) {
      setEditMode(null)
      return
    }
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, label: editValue.trim(), edited: true } : item)))
    setEditMode(null)
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function addCustomItem(type: "labor" | "part") {
    if (!customName.trim()) return
    setItems((prev) => [...prev, { type, label: customName.trim(), selected: true, edited: false }])
    setCustomName("")
    setAddingCustom(null)
  }

  async function handleAddSelected() {
    setSubmitting(true)
    try {
      const selectedItems = items.filter((i) => i.selected && i.type !== "inspection")
      const toAdd = selectedItems.map((i) => ({ type: i.type as "labor" | "part", name: i.label }))
      await onAddItems(toAdd, result?.customerDescription || "", result?.internalNote || "")
      setResult(null)
      setItems([])
    } catch {
      setError("Kalemler eklenirken hata oluştu")
    } finally {
      setSubmitting(false)
    }
  }

  function handleIgnore() {
    setResult(null)
    setItems([])
  }

  const selectedCount = items.filter((i) => i.selected && i.type !== "inspection").length
  const inspections = items.filter((i) => i.type === "inspection")
  const laborAndParts = items.filter((i) => i.type !== "inspection")

  const providerLabel =
    result?.provider === "mock" ? "Demo (Mock)" : result?.provider === "openai" ? "OpenAI" : result?.provider === "deepseek" ? "DeepSeek" : ""

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI Servis Danışmanı
          </CardTitle>
          {result && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground/70 hover:text-muted-foreground p-1"
              aria-label={expanded ? "Daralt" : "Genişlet"}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && !loading && (
          <>
            <p className="text-sm text-muted-foreground">
              Müşteri şikayetini analiz ederek kontrol, işçilik ve parça önerileri alın.
            </p>
            {customerComplaint && (
              <div className="p-2.5 rounded-lg bg-muted border border-border text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Şikayet</p>
                <p className="text-foreground line-clamp-3">{customerComplaint}</p>
              </div>
            )}
            <Button onClick={fetchAdvice} size="sm" className="w-full">
              <Sparkles className="size-3.5 mr-1.5" />
              Öneri Al
            </Button>
          </>
        )}

        {loading && (
          <div className="flex flex-col items-center py-6 gap-2">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">AI önerileriniz hazırlanıyor...</p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-foreground text-sm flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && expanded && (
          <>
            {result.missingInfoWarnings.length > 0 && (
              <div className="space-y-1.5">
                {result.missingInfoWarnings.map((w, i) => (
                  <div key={i} className="p-2 rounded-lg bg-warning/10 border border-warning/20 text-foreground text-xs flex items-start gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {inspections.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <ClipboardList className="size-3" /> Önerilen Kontroller
                </p>
                <div className="space-y-1">
                  {inspections.map((item, i) => {
                    const globalIndex = items.indexOf(item)
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                        <button
                          onClick={() => toggleItem(globalIndex)}
                          className={cn(
                            "size-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            item.selected ? "bg-primary border-primary" : "border-border bg-card"
                          )}
                        >
                          {item.selected && <CheckCircle2 className="size-3 text-white" />}
                        </button>
                        {editMode === String(globalIndex) ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(globalIndex)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(globalIndex)}
                            className="h-7 text-xs"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={cn("flex-1 truncate", item.selected ? "text-foreground" : "text-muted-foreground/70 line-through")}
                          >
                            {item.label}
                          </span>
                        )}
                        {editMode !== String(globalIndex) && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => startEdit(globalIndex)} className="p-1 text-muted-foreground/70 hover:text-primary rounded" aria-label="Düzenle">
                              <Edit3 className="size-3" />
                            </button>
                            <button onClick={() => removeItem(globalIndex)} className="p-1 text-muted-foreground/70 hover:text-destructive rounded" aria-label="Yoksay">
                              <X className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {laborAndParts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Wrench className="size-3" /> İşçilikler & Parçalar
                </p>
                <div className="space-y-1">
                  {laborAndParts.map((item, i) => {
                    const globalIndex = items.indexOf(item)
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                        <button
                          onClick={() => toggleItem(globalIndex)}
                          className={cn(
                            "size-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            item.selected ? "bg-primary border-primary" : "border-border bg-card"
                          )}
                        >
                          {item.selected && <CheckCircle2 className="size-3 text-white" />}
                        </button>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", item.type === "labor" ? "bg-primary/10 text-foreground" : "bg-success/10 text-foreground")}>
                          {item.type === "labor" ? "İşçilik" : "Parça"}
                        </span>
                        {editMode === String(globalIndex) ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(globalIndex)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(globalIndex)}
                            className="h-7 text-xs flex-1"
                            autoFocus
                          />
                        ) : (
                          <span className={cn("flex-1 truncate", item.selected ? "text-foreground" : "text-muted-foreground/70 line-through", item.edited && "italic text-primary")}>
                            {item.label}
                          </span>
                        )}
                        {editMode !== String(globalIndex) && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => startEdit(globalIndex)} className="p-1 text-muted-foreground/70 hover:text-primary rounded" aria-label="Düzenle">
                              <Edit3 className="size-3" />
                            </button>
                            <button onClick={() => removeItem(globalIndex)} className="p-1 text-muted-foreground/70 hover:text-destructive rounded" aria-label="Kaldır">
                              <X className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-2 flex gap-1.5">
                  {addingCustom ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder={`${addingCustom === "labor" ? "İşçilik" : "Parça"} adı...`}
                        className="h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && addCustomItem(addingCustom)}
                      />
                      <Button size="sm" variant="outline" onClick={() => addCustomItem(addingCustom)} className="h-7 text-xs shrink-0">
                        Ekle
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAddingCustom(null); setCustomName("") }} className="h-7 text-xs shrink-0">
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setAddingCustom("labor")} className="h-7 text-[11px]">
                        <Wrench className="size-3 mr-1" /> İşçilik Ekle
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAddingCustom("part")} className="h-7 text-[11px]">
                        <Package className="size-3 mr-1" /> Parça Ekle
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {result.customerDescription && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText className="size-3" /> Müşteri Açıklaması
                </p>
                <p className="text-sm text-foreground bg-white p-2.5 rounded-lg border border-border">
                  {result.customerDescription}
                </p>
              </div>
            )}

            {result.internalNote && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <StickyNote className="size-3" /> Servis İç Notu
                </p>
                <p className="text-sm text-muted-foreground bg-warning/10 p-2.5 rounded-lg border border-warning/20">
                  {result.internalNote}
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-1">Bu not müşteri çıktısında gösterilmez</p>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground flex items-start gap-1.5">
              <Shield className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <span>
                AI sonucu tavsiye niteliğindedir, kesin arıza teşhisi değildir. Önerilen kalemler otomatik eklenmez — eklemek için onaylamanız gerekir.
                {providerLabel && <span className="ml-1 text-muted-foreground">Sağlayıcı: {providerLabel}</span>}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
              <Button onClick={handleAddSelected} disabled={submitting || selectedCount === 0} size="sm" className="flex-1">
                {submitting ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1" />}
                İş Emrine Ekle{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </Button>
              <Button variant="outline" onClick={handleIgnore} size="sm" className="flex-1">
                <X className="size-3.5 mr-1" /> Yoksay
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}