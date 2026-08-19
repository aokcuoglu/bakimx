import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, ListChecks, Square, StickyNote, Timer } from "lucide-react"
import { CHECKLIST_CATEGORIES, type ChecklistCategoryKey } from "@/lib/constants"
import { summarizeChecklist } from "@/lib/technician/gates"
import { formatMinutes } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * İş emri ekranındaki teknisyen ilerlemesi — SALT OKUNUR.
 *
 * Aynı veriler teknisyen panelinde düzenlenebilir hâlde duruyor
 * (`technician-order-detail.tsx`). Burada bilinçli olarak hiçbir aksiyon yok:
 * kontrol listesi kanıt niteliğinde, işi yapan teknisyen işaretlemeli. Yönetici
 * de işaretleyebilseydi "kim doğruladı" sorusunun cevabı kaybolurdu.
 */

export interface TechnicianChecklistItem {
  id: string
  category: string
  description: string
  isCompleted: boolean
  isRequired: boolean
  completedAt: string | null
  note: string | null
}

export interface TechnicianLaborSession {
  id: string
  startTime: string
  endTime: string | null
  durationMinutes: number | null
  /// BAK-138: bu sürede ne yapıldığı.
  note: string | null
  /// BAK-138: doluysa saatler sayaçtan değil, elle düzeltmeden geliyor.
  editedAt: string | null
  editedByName: string | null
}

export interface TechnicianInternalNote {
  id: string
  content: string
  isPinned: boolean
  createdAt: string
}

const CATEGORY_ORDER: ChecklistCategoryKey[] = ["inspection", "repair", "delivery"]

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ChecklistCategoryBlock({
  category,
  items,
}: {
  category: ChecklistCategoryKey
  items: TechnicianChecklistItem[]
}) {
  if (items.length === 0) return null
  const info = CHECKLIST_CATEGORIES[category]

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
            info.color
          )}
        >
          {info.label}
        </span>
        <span className="text-xs text-muted-foreground/70">
          {items.filter((i) => i.isCompleted).length}/{items.length}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 py-1.5">
            {item.isCompleted ? (
              <CheckSquare className="size-5 text-success-strong shrink-0 mt-0.5" aria-hidden />
            ) : (
              <Square className="size-5 text-muted-foreground/70 shrink-0 mt-0.5" aria-hidden />
            )}
            <div className="flex-1 min-w-0">
              <span className={cn("text-sm", item.isCompleted ? "text-success-strong" : "text-foreground")}>
                {item.description}
              </span>
              <span className="sr-only">{item.isCompleted ? " — tamamlandı" : " — bekliyor"}</span>
              {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
              {item.completedAt && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {formatDateTime(item.completedAt)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TechnicianProgressPanel({
  checklistItems,
  laborSessions,
  internalNotes,
  technicianName,
}: {
  checklistItems: TechnicianChecklistItem[]
  laborSessions: TechnicianLaborSession[]
  internalNotes: TechnicianInternalNote[]
  technicianName: string | null
}) {
  const summary = summarizeChecklist(checklistItems)
  const activeLabor = laborSessions.find((l) => !l.endTime)
  const finishedLabor = laborSessions.filter((l) => l.endTime)
  const totalLaborMinutes = finishedLabor.reduce((sum, l) => sum + (l.durationMinutes || 0), 0)

  return (
    <div className="space-y-5">
      {!technicianName && (
        <p className="text-sm text-muted-foreground">
          Bu iş emrine henüz teknisyen atanmadı. Atama yapıldığında kontrol listesi otomatik oluşur.
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <ListChecks className="size-4" /> Kontrol Listesi
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {summary.completed} / {summary.total} tamamlandı
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Henüz kontrol maddesi yok</p>
          ) : (
            CATEGORY_ORDER.map((category) => (
              <ChecklistCategoryBlock
                key={category}
                category={category}
                items={checklistItems.filter((i) => i.category === category)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Timer className="size-4" /> İşçilik Süresi
            </span>
            {totalLaborMinutes > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                Toplam: {formatMinutes(totalLaborMinutes)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeLabor && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 rounded-lg bg-success/10 border border-success/20">
              <span className="size-2 rounded-full bg-success animate-pulse" aria-hidden />
              <span className="text-sm font-medium text-foreground">İşçilik devam ediyor</span>
              <span className="text-xs text-muted-foreground">
                Başlangıç: {formatTime(activeLabor.startTime)}
              </span>
            </div>
          )}

          {finishedLabor.length > 0 ? (
            <ul className="space-y-1.5">
              {finishedLabor.map((session) => (
                <li
                  key={session.id}
                  className="space-y-1 rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {formatTime(session.startTime)} → {formatTime(session.endTime!)}
                    </span>
                    <span className="font-medium">
                      {/* `!= null`: 0 dakikalık kayıt da bir süredir, "—" değil. */}
                      {session.durationMinutes != null ? formatMinutes(session.durationMinutes) : "—"}
                    </span>
                  </div>
                  {session.note && (
                    <p className="whitespace-pre-wrap break-words text-foreground">{session.note}</p>
                  )}
                  {session.editedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Elle düzeltildi · {formatDateTime(session.editedAt)}
                      {session.editedByName ? ` · ${session.editedByName}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            !activeLabor && (
              <p className="text-sm text-muted-foreground text-center py-3">
                Henüz işçilik kaydı yok
              </p>
            )
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <StickyNote className="size-4" /> İç Notlar
            </span>
            {internalNotes.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {internalNotes.length} not
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {internalNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Henüz iç not yok</p>
          ) : (
            <ul className="space-y-2">
              {internalNotes.map((note) => (
                <li
                  key={note.id}
                  className="flex items-start gap-2 py-2 px-3 rounded-lg bg-warning/10 border border-warning/20"
                >
                  <StickyNote className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    <p className="text-[10px] text-foreground/60 mt-1">{formatDateTime(note.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Bu bölüm salt okunurdur. İşaretleme, işçilik başlatma ve not ekleme teknisyen panelinden yapılır.
      </p>
    </div>
  )
}
