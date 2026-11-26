"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Check, HardHat, Loader2, Search, UserPlus, UserX } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TECHNICIAN_ROLES } from "@/lib/constants"
import { trIncludes } from "@/lib/tr-search"
import { cn } from "@/lib/utils"
import type { AssignableTechnician } from "@/lib/technician/queries"

export type { AssignableTechnician }

/** Arama kutusunu ancak liste göz taramasıyla bulunamayacak kadar uzunsa göster. */
const SEARCH_THRESHOLD = 5

function roleInfo(role: string) {
  return (TECHNICIAN_ROLES as Record<string, { label: string; color: string }>)[role]
}

/**
 * İş emrinin atanan ustasını gösteren ve tıklanınca atama modalını açan kontrol.
 *
 * Tek giriş noktasıdır: detay başlığı, "İş Emri Bilgileri" kartı ve iş emri
 * listesi aynı bileşeni kullanır — atama mantığı tek yerde durur.
 *
 * Kilitli emirde (teslim/iptal) salt-okunur rozete düşer.
 */
export function TechnicianAssign({
  orderId,
  assignedTechnicianId,
  assignedTechnicianName,
  technicians,
  locked = false,
  variant = "pill",
  className,
}: {
  orderId: string
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  technicians: AssignableTechnician[]
  locked?: boolean
  /**
   * Görünüm ölçüsü ve şekli Button `size` / `variant`'tan gelir (#889);
   * telefonda dokunma alanı şeffaf `::before` ile 44px'e açılır.
   * `pill` — `outline` `xs` hap (liste kartı, "İş Emri Bilgileri" kartı);
   *          usta yokken kesik çizgili, soluk.
   * `meta` — başlığın kimlik satırı; araç/müşteri satırlarıyla aynı dil,
   *          rozet ağırlığı taşımaz ki durum rozetleriyle yarışmasın.
   * `cta`  — usta henüz atanmadıysa beklenen adım budur (#866): birincil
   *          çerçeveli, ikonlu, standart ölçülü düğme (telefonda 44px).
   */
  variant?: "pill" | "meta" | "cta"
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(
    () => technicians.filter((t) => trIncludes(t.fullName, query)),
    [technicians, query]
  )

  const isMeta = variant === "meta"
  const isCta = variant === "cta"

  const label = assignedTechnicianName ?? "Usta ata"
  const Icon = assignedTechnicianName ? HardHat : UserPlus
  const iconSize = isCta ? "size-4" : "size-3.5"

  if (locked) {
    // Salt okunur: düğme değil, düz bilgi (meta satırı metni / hap rozeti).
    return isMeta ? (
      <span className={cn("inline-flex min-w-0 max-w-[12rem] items-center gap-1 text-sm text-muted-foreground", className)}>
        <Icon className={cn("shrink-0", iconSize)} />
        <span className="truncate">{assignedTechnicianName ?? "Usta atanmadı"}</span>
      </span>
    ) : (
      <Badge variant="outline" className={cn("max-w-[12rem] gap-1 text-muted-foreground", className)}>
        <Icon className={cn("shrink-0", iconSize)} />
        <span className="truncate">{assignedTechnicianName ?? "Usta atanmadı"}</span>
      </Badge>
    )
  }



  function runAssign(action: () => Promise<{ error?: string } | undefined>, successMessage: string) {
    startTransition(async () => {
      const result = await action()
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(successMessage)
      setOpen(false)
      setQuery("")
      router.refresh()
    })
  }

  function handleAssign(technician: AssignableTechnician) {
    if (technician.id === assignedTechnicianId) {
      setOpen(false)
      return
    }
    runAssign(async () => {
      const { assignTechnicianAction } = await import("@/app/(app)/technician/actions")
      return assignTechnicianAction(orderId, technician.id)
    }, `${technician.fullName} atandı`)
  }

  function handleUnassign() {
    runAssign(async () => {
      const { unassignTechnicianAction } = await import("@/app/(app)/technician/actions")
      return unassignTechnicianAction(orderId)
    }, "Usta ataması kaldırıldı")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* Ölçü ve şekil size / variant'tan (#889): hap `outline xs` (32/28px),
            meta satır içi bağlantı, CTA standart düğme. Telefonda şeffaf
            `::before` dokunma alanını 44px'e açar; md+ fareyle gerekmez. */}
        <Button
          type="button"
          variant={isMeta ? "link" : isCta ? "tint" : "outline"}
          size={isCta ? "default" : isMeta ? "inline" : "xs"}
          className={cn(
            isMeta && "relative min-w-0 max-w-[12rem] text-muted-foreground before:absolute before:inset-x-0 before:-inset-y-3 hover:text-primary md:before:hidden",
            // Noktalı alt çizgi "buraya dokunulabilir" der.
            isMeta && !assignedTechnicianName && "underline decoration-dotted",
            !isCta && !isMeta && "relative max-w-[12rem] before:absolute before:inset-x-0 before:-inset-y-1.5 md:before:hidden",
            !isCta && !isMeta && !assignedTechnicianName && "border-dashed text-muted-foreground",
            !isCta && "touch-manipulation",
            className
          )}
          aria-label={
            assignedTechnicianName
              ? `Atanan usta: ${assignedTechnicianName} — değiştir`
              : "Usta ata"
          }
        >
          <Icon className={cn("shrink-0", iconSize)} />
          {/* Meta satırı çevresiyle aynı metin boyunda (satır içi bağlantı). */}
          <span className={cn("truncate", isMeta && "text-sm")}>{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usta Ata</DialogTitle>
          <DialogDescription>Araç kabulünü üstlenecek ustayı seçin</DialogDescription>
        </DialogHeader>
        {technicians.length === 0 ? (
          <div className="py-8 text-center">
            <HardHat className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Henüz usta kaydı yok</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Atama yapabilmek için önce Ayarlar → Ekip sayfasından usta ekleyin.
            </p>
            <Button variant="foreground" className="mt-4" asChild>
              <Link href="/settings/team">
                <UserPlus className="size-4" />
                Usta Ekle
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {technicians.length >= SEARCH_THRESHOLD && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Usta ara..."
                  aria-label="Usta ara"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                &quot;{query}&quot; ile eşleşen usta yok
              </p>
            ) : (
              filtered.map((t) => {
                const info = roleInfo(t.role)
                const isAssigned = t.id === assignedTechnicianId
                return (
                  <Button
                    key={t.id}
                    type="button"
                    variant={isAssigned ? "secondary" : "outline"}
                    size="row"
                    onClick={() => handleAssign(t)}
                    disabled={isPending}
                    className="w-full"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <HardHat className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{t.fullName}</span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
                            info?.color || "border-border bg-muted text-muted-foreground"
                          )}
                        >
                          {info?.label || t.role}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t.activeJobs > 0 ? `${t.activeJobs} aktif iş` : "Boşta"}
                      </span>
                    </span>
                    {isAssigned && <Check className="size-4 shrink-0 text-primary" />}
                  </Button>
                )
              })
            )}
          </div>
        )}
        {assignedTechnicianId && (
          <DialogFooter>
            <Button variant="outline" onClick={handleUnassign} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
              Atamayı Kaldır
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
