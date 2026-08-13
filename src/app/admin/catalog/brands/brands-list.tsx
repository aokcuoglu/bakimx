"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Plus, PowerOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { typedResolver } from "@/lib/validations/resolver"
import { bakimxBrandFormSchema, type BakimxBrandFormValues } from "@/lib/validations/bakimx-product"
import {
  createBakimxBrandAction,
  deactivateBakimxBrandProductsAction,
  updateBakimxBrandAction,
} from "@/app/admin/catalog/actions"
import type { AdminCatalogBrandRow } from "@/app/admin/catalog/data"

export function BrandsList({ brands }: { brands: AdminCatalogBrandRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<AdminCatalogBrandRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deactivating, setDeactivating] = useState<AdminCatalogBrandRow | null>(null)
  const [pending, startTransition] = useTransition()

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(brand: AdminCatalogBrandRow) {
    setEditing(brand)
    setFormOpen(true)
  }

  function confirmDeactivate() {
    if (!deactivating) return
    const brandId = deactivating.id
    startTransition(async () => {
      const result = await deactivateBakimxBrandProductsAction(brandId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Markanın tüm ürünleri pasifleştirildi")
      setDeactivating(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/catalog" className="text-muted-foreground/70 hover:text-muted-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Markalar</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Katalog markaları. Pasif marka ürün eklemeyi engellemez; ürünleri ayrıca pasifleştirin.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5 mr-1" /> Yeni Marka
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {brands.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Henüz marka yok.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marka</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Ürün</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {brand.logoUrl && (
                        <Image
                          src={brand.logoUrl}
                          alt=""
                          width={24}
                          height={24}
                          unoptimized
                          className="size-6 rounded object-contain"
                        />
                      )}
                      <span className="font-medium text-foreground">{brand.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{brand.slug}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {brand.activeProductCount} / {brand.productCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={brand.isActive ? "default" : "secondary"}>
                      {brand.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(brand)}>
                        Düzenle
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={brand.activeProductCount === 0 || pending}
                        onClick={() => setDeactivating(brand)}
                      >
                        <PowerOff className="size-3.5 mr-1" /> Ürünleri pasifleştir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Yalnız açıkken monte edilir: her açılış formu markanın güncel değerleriyle
          sıfırdan kurar, efektle setState etmeye gerek kalmaz. */}
      {formOpen && (
        <BrandDialog
          key={editing?.id ?? "new"}
          onOpenChange={setFormOpen}
          brand={editing}
          onSaved={() => {
            setFormOpen(false)
            router.refresh()
          }}
        />
      )}

      <AlertDialog open={deactivating !== null} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Markanın tüm ürünleri pasifleştirilsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.name} markasının {deactivating?.activeProductCount ?? 0} aktif ürünü pasife alınır ve
              atölye yüzeyinde listelenmez. Marka kaydına dokunulmaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Pasifleştir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BrandDialog({
  onOpenChange,
  brand,
  onSaved,
}: {
  onOpenChange: (v: boolean) => void
  brand: AdminCatalogBrandRow | null
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<BakimxBrandFormValues, unknown, BakimxBrandFormValues>({
    resolver: typedResolver(bakimxBrandFormSchema),
    defaultValues: {
      name: brand?.name ?? "",
      logoUrl: brand?.logoUrl ?? "",
      isActive: brand?.isActive ?? true,
    },
  })

  function onSubmit(values: BakimxBrandFormValues) {
    setError(null)
    startTransition(async () => {
      const result = brand
        ? await updateBakimxBrandAction(brand.id, values)
        : await createBakimxBrandAction(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(brand ? "Marka güncellendi" : "Marka eklendi")
      onSaved()
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{brand ? "Markayı Düzenle" : "Yeni Marka"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marka adı *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Mutlu" autoFocus />
                  </FormControl>
                  <FormDescription>
                    Ad değişirse markanın ürün kartlarındaki marka adı ve arama anahtarı da güncellenir.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo adresi</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <FormLabel>Aktif</FormLabel>
                    <FormDescription>Pasif marka seçicilerde “pasif” etiketiyle görünür.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={(v) => field.onChange(v)} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {brand ? "Kaydet" : "Ekle"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
