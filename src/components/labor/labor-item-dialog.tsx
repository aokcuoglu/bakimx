"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput,
  AutocompleteItem, AutocompleteList,
} from "@/components/ui/autocomplete"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { liraToKurus, kurusToLira } from "@/lib/money"
import type { LaborCatalogRow } from "@/lib/labor/types"

export function LaborItemDialog({
  open, onOpenChange, item, categories,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  item: LaborCatalogRow | null
  categories: string[]
}) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [priceDraft, setPriceDraft] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Her açılışta formu düzenlenen kalemden (veya boştan) yeniden doldur.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- açılışta formu sıfırla
    setCode(item?.code ?? "")
    setName(item?.name ?? "")
    setCategory(item?.category ?? "")
    setPriceDraft(item?.defaultPriceKurus != null ? String(kurusToLira(item.defaultPriceKurus)) : "")
    setDescription(item?.description ?? "")
    setIsActive(item?.isActive ?? true)
  }, [open, item])

  const categoryItems = categories.filter((c) =>
    c.toLocaleLowerCase("tr").includes(category.toLocaleLowerCase("tr"))
  )

  async function submit() {
    if (!name.trim() || submitting) return
    setSubmitting(true)

    const lira = Number(priceDraft)
    const defaultPriceKurus =
      priceDraft.trim() && !Number.isNaN(lira) && lira >= 0 ? liraToKurus(lira) : null

    const payload = {
      code: code.trim(),
      name: name.trim(),
      category: category.trim(),
      defaultPriceKurus,
      description: description.trim(),
      isActive,
    }

    const actions = await import("@/app/(app)/parts/labor-actions")
    const res = item
      ? await actions.updateLaborItemAction(item.id, payload)
      : await actions.createLaborItemAction(payload)

    // NOT: sadece `"error" in res` yazılır — `&& res.error` eklemek birleşim
    // tipini erken dönüşten sonra daraltmaz ve başarı dalındaki alanlar derlenmez.
    if ("error" in res) {
      toast.error(res.error)
      setSubmitting(false)
      return
    }

    toast.success(item ? "İşçilik güncellendi" : "İşçilik eklendi")
    onOpenChange(false)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "İşçiliği Düzenle" : "Yeni İşçilik"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Kod</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ISC-001"
                className="text-sm"
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">İşçilik adı</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ör. motor yağı ve filtre değişimi"
                className="text-sm"
                maxLength={120}
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Kategori</span>
              <Autocomplete
                items={categoryItems}
                value={category}
                filter={null}
                openOnInputClick
                itemToStringValue={(c: string) => c}
                onValueChange={(v: string) => setCategory(v)}
              >
                <AutocompleteInput
                  render={<Input placeholder="Bakım, Fren, Motor…" className="text-sm" maxLength={60} />}
                />
                <AutocompleteContent>
                  <AutocompleteEmpty>Yeni kategori olarak kaydedilecek</AutocompleteEmpty>
                  <AutocompleteList>
                    {(c: string) => (
                      <AutocompleteItem key={c} value={c} onClick={() => setCategory(c)}>
                        {c}
                      </AutocompleteItem>
                    )}
                  </AutocompleteList>
                </AutocompleteContent>
              </Autocomplete>
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Varsayılan ücret</span>
              <InputGroup className="h-9">
                <InputGroupAddon className="text-muted-foreground">₺</InputGroupAddon>
                <InputGroupInput
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="text-sm tabular-nums"
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>

          <div className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">Açıklama</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="İsteğe bağlı not"
              className="text-sm min-h-16"
              maxLength={500}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Aktif</p>
              <p className="text-xs text-muted-foreground">Pasif kalemler iş emri önerilerinde çıkmaz</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Vazgeç
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {item ? "Kaydet" : "Ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
