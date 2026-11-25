"use client"

import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function CreditQuotaDialog({ included, extra, canPurchase }: { included: number; extra: number; canPurchase: boolean }) {
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline" size="sm">Kota seçenekleri</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Katalog kredisi</DialogTitle><DialogDescription>VIN ve TecDoc sorguları aynı aylık kotayı kullanır.</DialogDescription></DialogHeader>
      <dl className="space-y-2 rounded-lg border bg-card p-3 text-sm"><div className="flex justify-between"><dt>Paketinizde dahil</dt><dd>{included.toLocaleString("tr-TR")}</dd></div><div className="flex justify-between"><dt>Etkin ek kota</dt><dd>{extra.toLocaleString("tr-TR")}</dd></div><div className="flex justify-between border-t pt-2 font-semibold"><dt>Toplam aylık hak</dt><dd>{(included + extra).toLocaleString("tr-TR")}</dd></div></dl>
      <p className="text-sm text-muted-foreground">Ek kota için bizimle iletişime geçin. Bağımsız ek kota satın alımı henüz açık değildir.</p>
      {canPurchase && <DialogFooter><Button asChild variant="navy"><Link href="/settings/plans">Paketleri incele</Link></Button></DialogFooter>}
    </DialogContent>
  </Dialog>
}
