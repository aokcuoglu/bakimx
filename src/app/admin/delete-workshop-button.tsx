"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { deleteEmptyWorkshop } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export function DeleteWorkshopButton({ workshopId, name, blockers }: { workshopId: string; name: string; blockers: string[] }) {
  const [value, setValue] = useState(""); const [error, setError] = useState(""); const [pending, startTransition] = useTransition()
  const router = useRouter()
  if (blockers.length) return <div><Button variant="destructive" size="sm" disabled>İş yerini sil</Button><p className="mt-1 text-xs text-muted-foreground">Silme engelleri: {blockers.join(", ")}</p></div>
  return <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 />İş yerini sil</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Boş iş yerini kalıcı olarak sil</AlertDialogTitle><AlertDialogDescription>Başlangıç kullanıcıları, ayarlar, davetler, denetim/iletişim kayıtları ve bayrak override’ları da silinir. Devam etmek için “{name}” yazın.</AlertDialogDescription></AlertDialogHeader><Input value={value} onChange={(e) => setValue(e.target.value)} aria-label="İş yeri adıyla doğrula" />{error && <p className="text-sm text-destructive-strong" role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={pending || value !== name} onClick={(event) => { event.preventDefault(); startTransition(async () => { const r = await deleteEmptyWorkshop(workshopId, value); if (!r.ok) { setError(r.error); toast.error(r.error) } else { toast.success("İş yeri silindi"); router.push("/admin/workshops") } }) }}>Kalıcı olarak sil</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
