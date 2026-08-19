"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveChatMessageWire, LiveChatStatusWire, LiveChatThreadWire } from "@/lib/live-chat/types";

const TOKEN_KEY = "bakimx.livechat.token";

/** Panel açıkken yoklama aralığı. Neden yoklama: src/app/api/live-chat/messages/route.ts */
const POLL_MS = 4000;

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage kapalıysa sohbet tek sekme ömrü kadar yaşar — kabul */
  }
}

/**
 * Görüşme anahtarını dışarıdan yerleştirir — e-postadaki devam bağlantısı
 * (`/destek/<token>`) başka bir cihazda açıldığında kullanılır (BAK-99).
 * Anahtarın adı tek yerde kalsın diye kanca bunu kendisi dışa açar.
 */
export function adoptLiveChatToken(token: string): void {
  writeToken(token);
}

export interface StartPayload {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export interface LiveChatState {
  /** Sunucudan gelen açık/kapalı durumu; henüz gelmediyse null. */
  status: LiveChatStatusWire | null;
  thread: LiveChatThreadWire | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
}

/**
 * Canlı destek istemci durumu: durum sorgusu, sohbet başlatma, mesaj gönderme
 * ve yoklama. Görsel bileşenler bu kancayı tüketir; ağ mantığı burada tektir.
 */
export function useLiveChat(active: boolean) {
  const [status, setStatus] = useState<LiveChatStatusWire | null>(null);
  const [thread, setThread] = useState<LiveChatThreadWire | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Yoklama filtresi: en son gördüğümüz mesajın zamanı. Ref, çünkü yoklama
  // döngüsünün her turda yeniden kurulmasını istemiyoruz.
  const cursorRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const applyMessages = useCallback((incoming: LiveChatMessageWire[]) => {
    if (incoming.length === 0) return;
    setThread((current) => {
      if (!current) return current;
      const known = new Set(current.messages.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return current;
      return { ...current, messages: [...current.messages, ...fresh] };
    });
    cursorRef.current = incoming[incoming.length - 1].createdAt;
  }, []);

  /** Mevcut token'ın geçmişini getirir; token geçersizse temizler. */
  const loadThread = useCallback(async (token: string) => {
    const res = await fetch(`/api/live-chat/messages?token=${encodeURIComponent(token)}`);
    if (res.status === 404) {
      writeToken(null);
      tokenRef.current = null;
      setThread(null);
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as LiveChatThreadWire;
    setThread(data);
    cursorRef.current = data.messages.at(-1)?.createdAt ?? null;
  }, []);

  // Panel açıldığında durumu ve (varsa) mevcut sohbeti tazele.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function boot() {
      setLoading(true);
      try {
        const res = await fetch("/api/live-chat/status");
        const data = (await res.json()) as LiveChatStatusWire;
        if (cancelled) return;
        setStatus(data);

        const token = readToken();
        tokenRef.current = token;
        if (token && data.available) await loadThread(token);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [active, loadThread]);

  // Yeni mesaj yoklaması — yalnız panel açık ve aktif bir sohbet varken.
  //
  // Bağımlılık `thread` DEĞİL `hasThread`: `thread` her yoklamada yeni bir nesne
  // olduğu için effect'i ona bağlamak zamanlayıcıyı 4 saniyede bir söküp yeniden
  // kurardı (yoklama aralığı sürekli sıfırlanır, sekme gizliyken bile churn).
  const hasThread = thread !== null;
  useEffect(() => {
    if (!active || !hasThread) return;
    const token = tokenRef.current;
    if (!token) return;

    let stopped = false;
    const timer = setInterval(async () => {
      if (stopped || document.hidden) return;
      try {
        const query = cursorRef.current ? `&after=${encodeURIComponent(cursorRef.current)}` : "";
        const res = await fetch(`/api/live-chat/messages?token=${encodeURIComponent(token)}${query}`);
        if (!res.ok) return;
        const data = (await res.json()) as LiveChatThreadWire;
        applyMessages(data.messages);
        // Yalnız gerçekten değişen alan varsa yeni nesne üret — aksi hâlde her
        // tur boş bir yeniden çizim tetiklerdi.
        setThread((current) => {
          if (!current) return current;
          if (current.online === data.online && current.conversation.status === data.conversation.status) {
            return current;
          }
          return {
            ...current,
            online: data.online,
            conversation: { ...current.conversation, status: data.conversation.status },
          };
        });
      } catch {
        /* geçici ağ hatası — bir sonraki tur dener */
      }
    }, POLL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, hasThread, applyMessages]);

  const start = useCallback(async (payload: StartPayload): Promise<boolean> => {
    setSending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/live-chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, pageUrl: window.location.pathname }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errors = (data?.errors ?? {}) as Record<string, string>;
        const { _general, ...fields } = errors;
        setFieldErrors(fields);
        setError(_general ?? (Object.keys(fields).length ? null : "Sohbet başlatılamadı."));
        return false;
      }
      const wire = data as LiveChatThreadWire;
      writeToken(wire.conversation.token);
      tokenRef.current = wire.conversation.token;
      cursorRef.current = wire.messages.at(-1)?.createdAt ?? null;
      setThread(wire);
      return true;
    } catch {
      setError("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  const send = useCallback(async (body: string): Promise<boolean> => {
    const token = tokenRef.current;
    if (!token) return false;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/live-chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.errors?._general ?? data?.errors?.body ?? "Mesaj gönderilemedi.");
        return false;
      }
      const { message } = (await res.json()) as { message: LiveChatMessageWire };
      applyMessages([message]);
      return true;
    } catch {
      setError("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
      return false;
    } finally {
      setSending(false);
    }
  }, [applyMessages]);

  /** "Yeni sohbet" — token'ı bırakır, ön formu geri getirir. */
  const reset = useCallback(() => {
    writeToken(null);
    tokenRef.current = null;
    cursorRef.current = null;
    setThread(null);
    setError(null);
    setFieldErrors({});
  }, []);

  const state: LiveChatState = { status, thread, loading, sending, error, fieldErrors };
  return { ...state, start, send, reset };
}
