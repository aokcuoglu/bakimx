"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Check, HardHat, Loader2, Search, UserPlus, UserX } from "lucide-react"

import { BottomSheet } from "@/components/shared/bottom-sheet"
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
 * İş emrinin atanan ustasını gösteren ve tıklanınca atama sheet'ini açan kontrol.
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
  size = "md",
  variant = "pill",
  className,
}: {
  orderId: string
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  technicians: AssignableTechnician[]
  locked?: boolean
  size?: "sm" | "md"
  /**
   * `pill` — rozet görünümü (liste kartı, "İş Emri Bilgileri" kartı).
   * `meta` — başlığın kimlik satırı; araç/müşteri satırlarıyla aynı dil,
   *          rozet ağırlığı taşımaz ki durum rozetleriyle yarışmasın.
   */
  variant?: "pill" | "meta"
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

  const trigger = isMeta
    ? cn(
        "inline-flex max-w-[12rem] items-center gap-1 min-w-0 text-sm text-muted-foreground transition-colors touch-manipulation disabled:opacity-60",
        !locked && "hover:text-primary",
        // Noktalı alt çizgi "buraya dokunulabilir" demek; kilitli emirde
        // hiçbir şey yapılamadığı için vaat edilmemeli.
        !locked && !assignedTechnicianName && "underline decoration-dotted underline-offset-4",
        className
      )
    : cn(
        "inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border font-medium transition-colors touch-manipulation disabled:opacity-60",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        assignedTechnicianName
          ? "border-primary/20 bg-primary/10 text-foreground"
          : "border-dashed border-border bg-transparent text-muted-foreground",
        !locked && "hover:border-primary/40 hover:bg-primary/15",
        className
      )

  const label = assignedTechnicianName ?? "Usta ata"
  const Icon = assignedTechnicianName ? HardHat : UserPlus
  const iconSize = isMeta ? "size-3.5" : size === "sm" ? "size-3" : "size-3.5"

  if (locked) {
    return (
      <span className={cn(trigger, "cursor-default")}>
        <Icon className={cn("shrink-0", iconSize)} />
        <span className="truncate">{assignedTechnicianName ?? "Usta atanmadı"}</span>
      </span>
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
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title="Usta Ata"
      description="İş emrini üstlenecek ustayı seçin"
      trigger={
        <button
          type="button"
          className={trigger}
          aria-label={
            assignedTechnicianName
              ? `Atanan usta: ${assignedTechnicianName} — değiştir`
              : "Usta ata"
          }
        >
          <Icon className={cn("shrink-0", iconSize)} />
          <span className="truncate">{label}</span>
        </button>
      }
      footer={
        assignedTechnicianId ? (
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleUnassign}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
            Atamayı Kaldır
          </Button>
        ) : undefined
      }
    >
      {technicians.length === 0 ? (
        <div className="py-8 text-center">
          <HardHat className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Henüz usta kaydı yok</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Atama yapabilmek için önce iş yeri profilinize usta ekleyin.
          </p>
          <Button
            nativeButton={false}
            size="lg"
            className="mt-4"
            render={<Link href="/workshop" />}
          >
            <UserPlus className="size-4" />
            Usta Ekle
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pb-2">
          {technicians.length >= SEARCH_THRESHOLD && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Usta ara..."
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
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleAssign(t)}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors touch-manipulation disabled:opacity-60",
                    isAssigned
                      ? "border-primary/30 bg-primary/10"
                      : "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <HardHat className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
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
                </button>
              )
            })
          )}
        </div>
      )}
    </BottomSheet>
  )
}
