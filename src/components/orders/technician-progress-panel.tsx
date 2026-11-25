import { CheckSquare, Square, StickyNote } from "lucide-react"
import {
  DetailPanel,
  DetailPill,
  DetailEmpty,
  DetailItem,
  detail,
  surface,
  type DetailTone,
} from "./order-detail-surface"
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

const CATEGORY_TONE: Record<ChecklistCategoryKey, DetailTone> = {
  inspection: "info",
  repair: "warning",
  delivery: "success",
}

// `.item + .item` ayracı <li> kardeşlerinde eşleşmez; ayraç li'ye verilir.
const LI_SEP = "border-t border-[var(--dash-sep)] first:border-t-0"

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
    <div className={detail.group}>
      <div className={detail.groupHead}>
        <DetailPill tone={CATEGORY_TONE[category]}>{info.label}</DetailPill>
        <span className={detail.groupCount}>
          {items.filter((i) => i.isCompleted).length}/{items.length}
        </span>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={LI_SEP}>
            <DetailItem
              start={
                item.isCompleted ? (
                  <CheckSquare className="size-5 text-success-strong" aria-hidden />
                ) : (
                  <Square className="size-5 text-muted-foreground" aria-hidden />
                )
              }
              title={
                <span className={cn("font-normal", item.isCompleted ? "text-success-strong" : "text-foreground")}>
                  {item.description}
                  <span className="sr-only">{item.isCompleted ? " — tamamlandı" : " — bekliyor"}</span>
                </span>
              }
              sub={item.note}
              meta={item.completedAt && formatDateTime(item.completedAt)}
            />
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
    <div className={detail.stack}>
      {!technicianName && (
        <p className={detail.footnote}>
          Bu araç kabulüne henüz teknisyen atanmadı. Atama yapıldığında kontrol listesi otomatik oluşur.
        </p>
      )}

      <DetailPanel
        title="Kontrol Listesi"
        aside={
          <DetailPill tone={summary.total > 0 && summary.completed === summary.total ? "success" : "neutral"}>
            {summary.completed} / {summary.total} tamamlandı
          </DetailPill>
        }
      >
        {summary.total === 0 ? (
          <DetailEmpty>Henüz kontrol maddesi yok</DetailEmpty>
        ) : (
          CATEGORY_ORDER.map((category) => (
            <ChecklistCategoryBlock
              key={category}
              category={category}
              items={checklistItems.filter((i) => i.category === category)}
            />
          ))
        )}
      </DetailPanel>

      <DetailPanel
        title="İşçilik Süresi"
        aside={totalLaborMinutes > 0 && <DetailPill tone="neutral">Toplam: {formatMinutes(totalLaborMinutes)}</DetailPill>}
      >
        {activeLabor && (
          <DetailItem
            title="İşçilik devam ediyor"
            meta={`Başlangıç: ${formatTime(activeLabor.startTime)}`}
            end={
              <DetailPill tone="success">
                <span className="size-2 rounded-full bg-success animate-pulse" aria-hidden />
                Sürüyor
              </DetailPill>
            }
          />
        )}

        {finishedLabor.length > 0 ? (
          <ul>
            {finishedLabor.map((session) => (
              <li key={session.id} className={LI_SEP}>
                <DetailItem
                  title={`${formatTime(session.startTime)} → ${formatTime(session.endTime!)}`}
                  sub={
                    session.note ? (
                      <span className="whitespace-pre-wrap text-foreground">{session.note}</span>
                    ) : undefined
                  }
                  meta={
                    session.editedAt
                      ? `Elle düzeltildi · ${formatDateTime(session.editedAt)}${session.editedByName ? ` · ${session.editedByName}` : ""}`
                      : undefined
                  }
                  end={
                    <span className="text-[15px] font-medium tabular-nums text-foreground">
                      {/* `!= null`: 0 dakikalık kayıt da bir süredir, "—" değil. */}
                      {session.durationMinutes != null ? formatMinutes(session.durationMinutes) : "—"}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          !activeLabor && <DetailEmpty>Henüz işçilik kaydı yok</DetailEmpty>
        )}
      </DetailPanel>

      <DetailPanel
        title="İç Notlar"
        aside={internalNotes.length > 0 && <DetailPill tone="neutral">{internalNotes.length} not</DetailPill>}
      >
        {internalNotes.length === 0 ? (
          <DetailEmpty>Henüz iç not yok</DetailEmpty>
        ) : (
          <ul>
            {internalNotes.map((note) => (
              <li key={note.id} className={LI_SEP}>
                <DetailItem
                  start={
                    <span aria-hidden className={cn(surface.tile, surface["tone-warning"])}>
                      <StickyNote />
                    </span>
                  }
                  title={<span className="whitespace-pre-wrap font-normal">{note.content}</span>}
                  meta={formatDateTime(note.createdAt)}
                />
              </li>
            ))}
          </ul>
        )}
      </DetailPanel>

      <p className={detail.footnote}>
        Bu bölüm salt okunurdur. İşaretleme, işçilik başlatma ve not ekleme teknisyen panelinden yapılır.
      </p>
    </div>
  )
}
