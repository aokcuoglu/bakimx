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

  function handleChange(key: string | null) {
    if (!key || key === active) return
    router.replace(key === "labor" ? "/parts?tab=labor" : "/parts", { scroll: false })
  }

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList variant="line" className="flex w-full flex-nowrap gap-1 sm:gap-2 border-b border-border pb-0 -mb-px">
        <TabsTrigger value="parts" className="px-3 py-2.5 shrink-0 flex-none">
          <Boxes className="size-4" /> Parçalar
        </TabsTrigger>
        <TabsTrigger value="labor" className="px-3 py-2.5 shrink-0 flex-none">
          <Wrench className="size-4" /> İşçilikler
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
