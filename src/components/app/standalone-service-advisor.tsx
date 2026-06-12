"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ClipboardList,
  Wrench,
  Package,
  FileText,
  StickyNote,
} from "lucide-react"

type AdvisorResult = {
  suggestedInspections: string[]
  suggestedLabor: string[]
  suggestedParts: string[]
  customerDescription: string
  internalNote: string
  missingInfoWarnings: string[]
  provider: string
}

export function StandaloneServiceAdvisor() {
  const [complaint, setComplaint] = useState("")
  const [vehicleBrand, setVehicleBrand] = useState("")
  const [vehicleModel, setVehicleModel] = useState("")
  const [mileage, setMileage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<AdvisorResult | null>(null)
  const [expanded, setExpanded] = useState(true)

  async function fetchAdvice() {
    if (!complaint.trim()) {
      setError("Müşteri şikayeti gereklidir")
      return
    }
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaint,
          vehicleBrand,
          vehicleModel,
          mileage: mileage ? Number(mileage) : null,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setResult(data.result)
    } catch {
      setError("AI danışman bağlantı hatası")
    } finally {
      setLoading(false)
    }
  }

  const providerLabel =
    result?.provider === "mock" ? "Demo (Mock)" : result?.provider === "openai" ? "OpenAI" : result?.provider === "deepseek" ? "DeepSeek" : ""

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-blue-600" />
            AI Servis Danışmanı
          </CardTitle>
          {result && (
            <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600 p-1" aria-label={expanded ? "Daralt" : "Genişlet"}>
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2.5">
          <div>
            <Label className="text-xs">Müşteri Şikayeti *</Label>
            <Textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Fren sesi geliyor, klima soğutmuyor, motor arıza ışığı yanıyor..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Araç Marka</Label>
              <Input value={vehicleBrand} onChange={(e) => setVehicleBrand(e.target.value)} placeholder="Toyota" />
            </div>
            <div>
              <Label className="text-xs">Araç Model</Label>
              <Input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Corolla" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Kilometre</Label>
            <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="45000" />
          </div>
        </div>

        {!loading && (
          <Button onClick={fetchAdvice} size="sm" className="w-full" disabled={!complaint.trim()}>
            <Sparkles className="size-3.5 mr-1.5" />
            Öneri Al
          </Button>
        )}

        {loading && (
          <div className="flex flex-col items-center py-6 gap-2">
            <Loader2 className="size-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-600">AI önerileriniz hazırlanıyor...</p>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && expanded && (
          <div className="space-y-3 pt-3 border-t">
            {result.missingInfoWarnings.length > 0 && (
              <div className="space-y-1.5">
                {result.missingInfoWarnings.map((w, i) => (
                  <div key={i} className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {result.suggestedInspections.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <ClipboardList className="size-3" /> Önerilen Kontroller
                </p>
                <div className="space-y-1">
                  {result.suggestedInspections.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm text-slate-700">
                      <CheckCircle2 className="size-3.5 text-blue-500 shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.suggestedLabor.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Wrench className="size-3" /> Önerilen İşçilikler
                </p>
                <div className="space-y-1">
                  {result.suggestedLabor.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm text-slate-700">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 shrink-0">İşçilik</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.suggestedParts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Package className="size-3" /> Olası Parça İhtiyaçları
                </p>
                <div className="space-y-1">
                  {result.suggestedParts.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm text-slate-700">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">Parça</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.customerDescription && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText className="size-3" /> Müşteri Açıklaması
                </p>
                <p className="text-sm text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">{result.customerDescription}</p>
              </div>
            )}

            {result.internalNote && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <StickyNote className="size-3" /> Servis İç Notu
                </p>
                <p className="text-sm text-slate-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">{result.internalNote}</p>
                <p className="text-[11px] text-slate-500 italic mt-1">Bu not müşteri çıktısında gösterilmez</p>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-start gap-1.5">
              <Shield className="size-3.5 shrink-0 mt-0.5 text-slate-500" />
              <span>
                AI sonucu tavsiye niteliğindedir, kesin arıza teşhisi değildir.
                {providerLabel && <span className="ml-1 text-slate-500">Sağlayıcı: {providerLabel}</span>}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}