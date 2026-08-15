"use client"

import { useState, useEffect } from "react"
import { ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface VehicleBrand {
  id: number
  name: string
}

interface VehicleModel {
  id: number
  name: string
}

interface VehicleType {
  id: number
  name: string
}

interface VehicleTypeSelectorProps {
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export function VehicleTypeSelector({ selectedIds, onChange }: VehicleTypeSelectorProps) {
  const [brands, setBrands] = useState<VehicleBrand[]>([])
  const [models, setModels] = useState<VehicleModel[]>([])
  const [types, setTypes] = useState<VehicleType[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string>("")
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [selectedType, setSelectedType] = useState<string>("")
  const [typeNames, setTypeNames] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchBrands()
    fetchTypeNames()
  }, [])

  useEffect(() => {
    if (selectedBrand) {
      fetchModels(Number(selectedBrand))
      setSelectedModel("")
      setTypes([])
    } else {
      setModels([])
      setTypes([])
    }
  }, [selectedBrand])

  useEffect(() => {
    if (selectedModel) {
      fetchTypes(Number(selectedBrand), Number(selectedModel))
      setSelectedType("")
    } else {
      setTypes([])
    }
  }, [selectedModel, selectedBrand])

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/vehicle-catalog/brands")
      const data = await res.json()
      setBrands(data.brands || [])
    } catch (error) {
      console.error("Marka yükleme hatası:", error)
    }
  }

  const fetchModels = async (brandId: number) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/vehicle-catalog/models?brandId=${brandId}`)
      const data = await res.json()
      setModels(data.models || [])
    } catch (error) {
      console.error("Model yükleme hatası:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTypes = async (brandId: number, modelId: number) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/vehicle-catalog/types?brandId=${brandId}&modelId=${modelId}`)
      const data = await res.json()
      setTypes(data.types || [])
    } catch (error) {
      console.error("Araç tipi yükleme hatası:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTypeNames = async () => {
    if (selectedIds.length === 0) return
    try {
      const res = await fetch(`/api/vehicle-catalog/types/names?ids=${selectedIds.join(",")}`)
      const data = await res.json()
      setTypeNames(data.names || {})
    } catch (error) {
      console.error("Araç tipi adları yükleme hatası:", error)
    }
  }

  const addType = () => {
    if (!selectedType) return
    const typeId = Number(selectedType)
    if (!selectedIds.includes(typeId)) {
      const newIds = [...selectedIds, typeId]
      onChange(newIds)
      const typeName = types.find((t) => t.id === typeId)?.name || `Type ${typeId}`
      setTypeNames({ ...typeNames, [typeId]: typeName })
    }
    setSelectedType("")
  }

  const removeType = (typeId: number) => {
    onChange(selectedIds.filter((id) => id !== typeId))
    const newNames = { ...typeNames }
    delete newNames[typeId]
    setTypeNames(newNames)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={selectedBrand || ""} onValueChange={(v) => setSelectedBrand(v || "")}>
          <SelectTrigger>
            <SelectValue placeholder="Marka seçin" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedModel || ""} onValueChange={(v) => setSelectedModel(v || "")} disabled={!selectedBrand || loading}>
          <SelectTrigger>
            <SelectValue placeholder="Model seçin" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedType || ""} onValueChange={(v) => setSelectedType(v || "")} disabled={!selectedModel || loading}>
          <SelectTrigger>
            <SelectValue placeholder="Araç tipi seçin" />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="button" onClick={addType} disabled={!selectedType} variant="outline" className="w-full">
        Araç tipi ekle
      </Button>

      {selectedIds.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Seçilen araçlar ({selectedIds.length}):</div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((typeId) => (
              <Badge key={typeId} variant="secondary" className="gap-1">
                {typeNames[typeId] || `Type ${typeId}`}
                <button
                  onClick={() => removeType(typeId)}
                  className="ml-1 inline-flex items-center rounded hover:bg-destructive/20"
                  aria-label="Kaldır"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
