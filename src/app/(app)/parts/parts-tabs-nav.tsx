"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Boxes, Wrench } from "lucide-react"

/**
 * Stok ekranının iki sekmesi: Parçalar / İşçilikler.
 * Sekme değişince filtre parametreleri (q, status, category, brand) bilerek
 * DÜŞÜRÜLÜR — parça filtresinin işçilik listesine sızmış gibi görünmesini önler.
 */
export function PartsTabsNav({ active }: { active: "parts" | "labor" }) {
  const router = useRouter()

  function handleChange(key: string) {
    if (key === active) return
    router.replace(key === "labor" ? "/parts?tab=labor" : "/parts", { scroll: false })
  }

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList variant="line" size="control" className="flex w-full flex-nowrap gap-1 sm:gap-2 border-b border-border -mb-px">
        <TabsTrigger value="parts" className="shrink-0 flex-none">
          <Boxes className="size-4" /> Parçalar
        </TabsTrigger>
        <TabsTrigger value="labor" className="shrink-0 flex-none">
          <Wrench className="size-4" /> İşçilikler
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
