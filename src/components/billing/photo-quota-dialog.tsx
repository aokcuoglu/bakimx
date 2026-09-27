"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function PhotoQuotaDialog({ limit }: { limit: number }) {
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline" size="sm">Fotoğraf hakkı</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Fotoğraf hakkı</DialogTitle><DialogDescription>Aktif fotoğraflar her iş emrinde ayrı sayılır.</DialogDescription></DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between rounded-lg border bg-card p-3"><span>İş emri başına dahil hak</span><strong>{limit} fotoğraf</strong></div>
        <p className="text-muted-foreground">Silinen fotoğraflar aktif hakka dahil değildir. Şu anda fotoğraf için satın alınabilen ek hak tanımlı değil.</p>
      </div>
    </DialogContent>
  </Dialog>
}
