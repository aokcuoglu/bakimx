"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface VehicleType {
  id: number
  name: string
  modelId: number
  modelName: string
  brandId: number
  brandName: string
}

export function VehicleTypeSelector({
  value,
  onChange,
}: {
  value: number[]
  onChange: (value: number[]) => void
}) {
  const [brands, setBrands] = useState<Array<{ id: number; name: string }>>([])
  const [models, setModels] = useState<Array<{ id: number; name: string; brandId: number }>>([])
  const [types, setTypes] = useState<VehicleType[]>([])
  const [selectedBrand, setSelectedBrand] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<Map<number, VehicleType>>(new Map())

  const loadBrands = () => {
    fetch("/api/vehicle-catalog/brands")
      .then(r => r.json())
      .then(d => setBrands(d?.brands || []))
      .catch(() => setBrands([]))
  }

  const loadModels = (brandId: number) => {
    if (!brandId) {
      setModels([])
      return
    }
    fetch(`/api/vehicle-catalog/models?brandId=${brandId}`)
      .then(r => r.json())
      .then(d => setModels(d?.models || []))
      .catch(() => setModels([]))
  }

  const loadTypes = (modelId: number) => {
    if (!modelId) {
      setTypes([])
      return
    }
    setLoading(true)
    fetch(`/api/vehicle-catalog/types?modelId=${modelId}`)
      .then(r => r.json())
      .then(d => setTypes(d?.types || []))
      .catch(() => setTypes([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // Initialize selected types
    const map = new Map(selectedTypes)
    for (const id of value) {
      if (!map.has(id)) {
        map.set(id, { id, name: "Yükleniyor...", modelId: 0, modelName: "", brandId: 0, brandName: "" })
      }
    }
    setSelectedTypes(map)
  }, [])

  useEffect(() => {
    loadBrands()
  }, [])

  useEffect(() => {
    loadModels(selectedBrand || 0)
  }, [selectedBrand])

  useEffect(() => {
    loadTypes(selectedModel || 0)
  }, [selectedModel])

  const filteredModels = selectedBrand
    ? models.filter(m => m.brandId === selectedBrand)
    : []

  const filteredTypes = selectedModel
    ? types.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  function addType(type: VehicleType) {
    const newMap = new Map(selectedTypes)
    newMap.set(type.id, type)
    setSelectedTypes(newMap)
    const newIds = Array.from(newMap.keys())
    onChange(newIds)
    setSearchQuery("")
  }

  function removeType(typeId: number) {
    const newMap = new Map(selectedTypes)
    newMap.delete(typeId)
    setSelectedTypes(newMap)
    const newIds = Array.from(newMap.keys())
    onChange(newIds)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Array.from(selectedTypes.values()).map(type => (
          <Badge key={type.id} variant="secondary" className="flex items-center gap-1">
            {type.brandName} {type.modelName} - {type.name}
            <button
              type="button"
              onClick={() => removeType(type.id)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <Popover>
        <PopoverTrigger className="w-full">
          <button type="button" className="w-full px-3 py-2 text-sm border rounded-md hover:bg-accent inline-flex items-center justify-center">
            <Plus className="h-4 w-4 mr-2" />
            Araç tipi ekle
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Marka</label>
              <select
                value={selectedBrand || ""}
                onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : null
                  setSelectedBrand(id)
                  setSelectedModel(null)
                }}
                className="w-full px-2 py-1 border rounded text-sm"
              >
                <option value="">Marka seçin</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {selectedBrand && (
              <div>
                <label className="text-sm font-medium">Model</label>
                <select
                  value={selectedModel || ""}
                  onChange={e => setSelectedModel(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2 py-1 border rounded text-sm"
                >
                  <option value="">Model seçin</option>
                  {filteredModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedModel && (
              <div>
                <label className="text-sm font-medium">Araç tipi</label>
                <Input
                  placeholder="Ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="mb-2"
                />
                <div className="h-48 overflow-y-auto space-y-1">
                  {loading ? (
                    <div className="text-sm text-muted-foreground p-2">Yükleniyor...</div>
                  ) : filteredTypes.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">Araç tipi bulunamadı</div>
                  ) : (
                    filteredTypes.map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => addType(type)}
                        disabled={selectedTypes.has(type.id)}
                        className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {type.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
