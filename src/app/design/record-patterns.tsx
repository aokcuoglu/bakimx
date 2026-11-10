"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Activity, CalendarDays, LayoutGrid, Mail, Users, Wrench } from "lucide-react"
import { toast } from "sonner"
import { type DesignPreviewValues, designPreviewSchema } from "@/lib/validations/design-preview"
import { HighlightCard } from "@/components/shared/highlight-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

export function RecordPatterns() {
  const [open, setOpen] = useState(false)
  const form = useForm<DesignPreviewValues>({
    resolver: zodResolver(designPreviewSchema),
    defaultValues: { title: "", description: "", duration: "30" },
  })
  return (
    <div data-testid="record-patterns" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="text-base leading-5 font-semibold">Servis kaydı</h3>
          <p className="mt-1 text-xs text-muted-foreground">Örnek veriler · Tasarım önizlemesi</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="outline"><CalendarDays />Randevu örneği</Button></DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CalendarDays className="size-4" />Yeni randevu</DialogTitle>
              <DialogDescription>Bu tasarım örneği gerçek bir kayıt oluşturmaz.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(() => { setOpen(false); form.reset(); toast.success("Önizleme tamamlandı. Kayıt oluşturulmadı.") })} className="space-y-6">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Randevu başlığı</FormLabel>
                    <FormControl><Input {...field} placeholder="Randevu başlığı" className="h-7 border-transparent px-1 text-base font-semibold shadow-none md:text-base" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Açıklama</FormLabel>
                    <FormControl><Textarea {...field} placeholder="Bir açıklama ekleyin" className="min-h-20 resize-none border-transparent px-1 shadow-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="border-t pt-5">
                  <FormField control={form.control} name="duration" render={({ field }) => (
                    <FormItem className="max-w-60">
                      <FormLabel className="text-xs text-muted-foreground">Süre</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="30">30 dakika</SelectItem><SelectItem value="60">1 saat</SelectItem></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="space-y-2 pb-2">
                  <p className="text-xs font-medium text-muted-foreground">İlişkili kayıt</p>
                  <p className="flex items-center gap-2 text-sm"><Wrench className="size-4 text-muted-foreground" />Örnek servis kaydı</p>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Vazgeç</Button></DialogClose>
                  <Button type="submit" variant="foreground">Önizlemeyi tamamla</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <Tabs defaultValue="overview" className="gap-0">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto overflow-y-hidden border-b px-3" aria-label="Kayıt bölümleri">
          <TabsTrigger value="overview"><LayoutGrid />Genel bakış</TabsTrigger>
          <TabsTrigger value="activity"><Activity />Hareketler</TabsTrigger>
          <TabsTrigger value="emails"><Mail />E-postalar <span className="rounded-xs bg-muted px-1 text-xs">0</span></TabsTrigger>
          <TabsTrigger value="team"><Users />Ekip</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6 p-4 sm:p-5">
          <section className="space-y-2" aria-label="Özet bilgiler">
            <h4 className="text-sm font-medium text-muted-foreground">Öne çıkanlar</h4>
            <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 md:grid-cols-3">
              <HighlightCard label="İş emri durumu" value="İşlemde" accessory={<Wrench />} />
              <HighlightCard label="Sonraki randevu" value="Henüz planlanmadı" accessory={<CalendarDays />} />
              <HighlightCard label="Ekip" value="Atanmadı" accessory={<Users />} />
              <HighlightCard label="Tahmini tutar" value="₺4.500,00" />
              <HighlightCard label="Ödeme" value="Bekleniyor" />
              <HighlightCard label="Son işlem" value="Bugün" />
            </div>
          </section>
          <section className="space-y-2"><h4 className="text-sm font-medium text-muted-foreground">Hareketler</h4><div className="flex items-center gap-2 rounded-xl border p-3"><Activity className="size-4 text-muted-foreground" /><span>Örnek servis kaydı açıldı</span></div></section>
        </TabsContent>
        <TabsContent value="activity" className="min-h-64 p-5"><p>Örnek servis kaydı açıldı.</p></TabsContent>
        <TabsContent value="emails" className="min-h-64 p-5"><p className="text-muted-foreground">Henüz e-posta yok.</p></TabsContent>
        <TabsContent value="team" className="min-h-64 p-5"><p className="text-muted-foreground">Henüz ekip atanmadı.</p></TabsContent>
      </Tabs>
    </div>
  )
}
