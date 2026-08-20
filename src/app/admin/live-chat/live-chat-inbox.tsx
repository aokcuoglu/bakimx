"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, MoonStar, RotateCcw, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { MAX_MESSAGE_LENGTH } from "@/lib/validations/live-chat"
import {
  markConversationReadAction,
  sendAgentReplyAction,
  setConversationStatusAction,
} from "./actions"
import type { InboxFilter, InboxRow, ThreadDetail } from "./data"

/** Gelen kutusu tazeleme aralığı — canlı destek dakikalar değil saniyeler işidir. */
const REFRESH_MS = 5000

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "open", label: "Açık" },
  { value: "closed", label: "Kapalı" },
  { value: "all", label: "Tümü" },
]

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

/**
 * Sunucu bileşenini düzenli aralıklarla tazeler. `router.refresh()` yumuşak bir
 * yenilemedir: istemci durumu (yazılmakta olan yanıt) korunur. Ayrı bir yoklama
 * uç noktası yazmak yerine bunu kullanıyoruz — tek veri kaynağı sayfanın kendisi.
 * Sekme arka plandayken durur, boşuna sorgu atmaz.
 */
function useAutoRefresh(enabled: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [enabled, router])
}

function ConversationList({
  rows,
  filter,
  selectedId,
}: {
  rows: InboxRow[]
  filter: InboxFilter
  selectedId: string | null
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            asChild
          >
            <Link href={`/admin/live-chat?filter=${f.value}`}>
              {f.label}
            </Link>
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Bu filtrede görüşme yok.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/live-chat?filter=${filter}&c=${row.id}`}
                className={cn(
                  "flex flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-muted",
                  selectedId === row.id && "bg-primary/5",
                )}
              >
                <div className="flex items-center gap-2">
                  {row.unread && (
                    <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Okunmamış" />
                  )}
                  <span className={cn("min-w-0 flex-1 truncate text-sm", row.unread && "font-semibold")}>
                    {row.visitorName}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDateTime(row.lastMessageAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{row.preview}</p>
                <div className="flex flex-wrap items-center gap-1">
                  {row.status === "closed" && <Badge variant="secondary">Kapalı</Badge>}
                  {row.startedOffline && (
                    <Badge variant="outline">
                      <MoonStar /> Mesai dışı
                    </Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ThreadPanel({ thread, filter }: { thread: ThreadDetail; filter: InboxFilter }) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const lastMessageId = thread.messages.at(-1)?.id ?? null

  // Görüşme açıldığında ve yeni mesaj geldiğinde okundu damgasını ilerlet.
  useEffect(() => {
    if (!lastMessageId) return
    void markConversationReadAction(thread.id)
  }, [thread.id, lastMessageId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [lastMessageId])

  function submit() {
    const body = draft.trim()
    if (!body || pending) return
    setError(null)
    startTransition(async () => {
      const result = await sendAgentReplyAction(thread.id, body)
      if (result.ok) setDraft("")
      else setError(result.error)
    })
  }

  function toggleStatus() {
    startTransition(async () => {
      const result = await setConversationStatusAction(thread.id, thread.status === "open" ? "closed" : "open")
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex min-h-[60vh] flex-col rounded-lg border bg-card">
      <header className="flex flex-wrap items-start gap-2 border-b px-3 py-2.5">
        <Button
          size="icon"
          variant="ghost"
          className="lg:hidden"
          aria-label="Listeye dön"
          asChild
        >
          <Link href={`/admin/live-chat?filter=${filter}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{thread.visitorName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {thread.visitorEmail}
            {thread.visitorPhone ? ` · ${thread.visitorPhone}` : ""}
          </p>
          {thread.pageUrl && (
            <p className="truncate text-[11px] text-muted-foreground">Sayfa: {thread.pageUrl}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={toggleStatus} disabled={pending}>
          {thread.status === "open" ? (
            <>
              <CheckCircle2 className="size-3.5" /> Kapat
            </>
          ) : (
            <>
              <RotateCcw className="size-3.5" /> Yeniden aç
            </>
          )}
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {thread.messages.map((message) => {
          if (message.sender === "system") {
            return (
              <p key={message.id} className="rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                {message.body}
              </p>
            )
          }
          const isAgent = message.sender === "agent"
          return (
            <div key={message.id} className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2",
                  isAgent ? "bg-primary text-primary-foreground" : "border bg-muted/40 text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    isAgent ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {isAgent ? message.agentEmail || "Destek" : thread.visitorName} · {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-3 pb-1 text-xs text-destructive-strong">{error}</p>}

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          rows={2}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Yanıtınızı yazın… (Enter gönderir, Shift+Enter satır atlar)"
          aria-label="Yanıtınız"
          className="max-h-32 resize-none"
        />
        <Button onClick={submit} disabled={pending || draft.trim().length === 0} aria-label="Yanıtı gönder">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

export function LiveChatInbox({
  rows,
  thread,
  filter,
}: {
  rows: InboxRow[]
  thread: ThreadDetail | null
  filter: InboxFilter
}) {
  useAutoRefresh(true)

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className={cn(thread && "hidden lg:block")}>
        <ConversationList rows={rows} filter={filter} selectedId={thread?.id ?? null} />
      </div>
      <div className={cn(!thread && "hidden lg:block")}>
        {thread ? (
          <ThreadPanel thread={thread} filter={filter} />
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center rounded-lg border border-dashed">
            <p className="px-6 text-center text-sm text-muted-foreground">
              Yanıtlamak için soldan bir görüşme seçin.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
