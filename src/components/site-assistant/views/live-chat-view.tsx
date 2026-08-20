"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH } from "@/lib/validations/live-chat";
import type { LiveChatMessageWire, LiveChatStatusWire } from "@/lib/live-chat/types";
import { useLiveChat } from "../use-live-chat";
import { ViewHeader } from "./view-header";

interface LiveChatViewProps {
  onBack: () => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Çevrimdışıyken gösterilen "ne zaman açığız" kartı. */
function HoursCard({ status }: { status: LiveChatStatusWire }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Clock className="size-3.5 shrink-0" />
        Destek saatlerimiz
      </p>
      <dl className="mt-2 space-y-0.5">
        {status.hours.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 text-xs">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={cn("tabular-nums", row.text === "Kapalı" ? "text-muted-foreground" : "text-foreground")}>
              {row.text}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MessageBubble({ message }: { message: LiveChatMessageWire }) {
  const isVisitor = message.sender === "visitor";
  const isSystem = message.sender === "system";

  if (isSystem) {
    return (
      <div className="rounded-xl bg-muted/60 px-3 py-2">
        <p className="text-xs text-muted-foreground">{message.body}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex", isVisitor ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2",
          isVisitor ? "bg-primary text-primary-foreground" : "border bg-card text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        <p className={cn("mt-1 text-[10px]", isVisitor ? "text-primary-foreground" : "text-muted-foreground")}>
          {isVisitor ? "Siz" : "Destek"} · {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

/**
 * Sohbet öncesi form. Kardeş görünümlerle (demo/destek formu) tutarlı olsun diye
 * react-hook-form yerine yerel state kullanır: bu widget her pazarlama sayfasının
 * ortak paketine giriyor, dört alan için form kütüphanesi taşımak gereksiz.
 */
function PreChatForm({
  status,
  sending,
  error,
  fieldErrors,
  onStart,
}: {
  status: LiveChatStatusWire;
  sending: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onStart: (payload: { name: string; email: string; phone: string; message: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const errors = { ...localErrors, ...fieldErrors };

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Ad Soyad en az 2 karakter olmalıdır";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Geçerli bir e-posta adresi girin";
    if (phone.trim() && !/^[0-9+\-\s()]{7,20}$/.test(phone.trim())) next.phone = "Geçerli bir telefon numarası girin";
    if (message.trim().length < 2) next.message = "Mesajınızı yazın";
    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;
    onStart({ name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <div className={cn("rounded-xl px-3 py-2.5", status.online ? "bg-success/10" : "bg-muted/60")}>
        <p className="text-sm text-foreground">{status.online ? status.greeting : status.offlineMessage}</p>
        {!status.online && status.nextOpeningText && (
          <p className="mt-1 text-xs text-muted-foreground">{status.nextOpeningText}</p>
        )}
      </div>

      {!status.online && <HoursCard status={status} />}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-foreground">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="lc-name">Ad Soyad *</Label>
        <Input id="lc-name" placeholder="Ahmet Yılmaz" value={name} onChange={(e) => setName(e.target.value)} />
        {errors.name && <p className="text-xs text-destructive-strong">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lc-email">E-posta *</Label>
        <Input
          id="lc-email"
          type="email"
          inputMode="email"
          placeholder="ornek@servis.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errors.email && <p className="text-xs text-destructive-strong">{errors.email}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lc-phone">Telefon (opsiyonel)</Label>
        <Input
          id="lc-phone"
          inputMode="tel"
          placeholder="0532 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {errors.phone && <p className="text-xs text-destructive-strong">{errors.phone}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lc-message">Mesajınız *</Label>
        <Textarea
          id="lc-message"
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Size nasıl yardımcı olabiliriz?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {errors.message && <p className="text-xs text-destructive-strong">{errors.message}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={sending}>
        {sending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Bağlanıyor...
          </>
        ) : status.online ? (
          "Sohbeti başlat"
        ) : (
          "Mesajı bırak"
        )}
      </Button>
    </form>
  );
}

export function LiveChatView({ onBack }: LiveChatViewProps) {
  const { status, thread, loading, sending, error, fieldErrors, start, send, reset } = useLiveChat(true);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const messageCount = thread?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status || !status.available) {
    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <ViewHeader title="Canlı Destek" onBack={onBack} />
        <p className="text-sm text-muted-foreground">
          Canlı destek şu anda kullanılamıyor. Menüdeki <strong>Destek / İletişim</strong> formundan bize
          ulaşabilirsiniz.
        </p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        <div className="px-4 pt-4">
          <ViewHeader title="Canlı Destek" onBack={onBack} />
        </div>
        <PreChatForm
          status={status}
          sending={sending}
          error={error}
          fieldErrors={fieldErrors}
          onStart={(payload) => void start(payload)}
        />
      </div>
    );
  }

  async function submitDraft() {
    const body = draft.trim();
    if (!body || sending) return;
    // İyimser temizleme yok: gönderim başarısız olursa yazı kaybolmasın.
    if (await send(body)) setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4">
        <ViewHeader title="Canlı Destek" onBack={onBack} />
      </div>

      {!thread.online && (
        <p className="mx-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Ekibimiz şu an çevrimdışı. {status.nextOpeningText ?? ""} Mesajınız kaydedilir, dönüş yapacağız.
        </p>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {thread.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-destructive-strong">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitDraft();
        }}
        className="flex items-end gap-2 border-t bg-card p-3"
      >
        <Textarea
          rows={1}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter gönderir, Shift+Enter satır atlar — sohbet kutusu beklentisi.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submitDraft();
            }
          }}
          placeholder="Mesajınızı yazın..."
          aria-label="Mesajınız"
          className="max-h-28 min-h-9 resize-none"
        />
        <Button type="submit" size="icon" aria-label="Gönder" disabled={sending || draft.trim().length === 0}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>

      <div className="border-t px-3 py-1.5">
        <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={reset}>
          <RefreshCw className="mr-1 size-3" /> Yeni sohbet başlat
        </Button>
      </div>
    </div>
  );
}
