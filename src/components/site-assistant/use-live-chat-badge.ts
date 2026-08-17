"use client";

import { useEffect, useState } from "react";

export type LiveChatBadge = { available: boolean; online: boolean };

/**
 * Canlı destek satırının rozetini besleyen minimum sorgu.
 *
 * Menüde ve cevap görünümünün "bulamadık" düşüşünde aynı karar veriliyor:
 * kapalı bir kanalı seçenek olarak sunma. `null` = durum henüz bilinmiyor,
 * satır hiç gösterilmez.
 */
export function useLiveChatBadge(): LiveChatBadge | null {
  const [state, setState] = useState<LiveChatBadge | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/live-chat/status")
      .then((res) => res.json())
      .then((data: { available?: boolean; online?: boolean }) => {
        if (!cancelled) setState({ available: data.available === true, online: data.online === true });
      })
      .catch(() => {
        // Durum alınamazsa satırı hiç gösterme — "çevrimiçi" yalanı söylemektense yok say.
        if (!cancelled) setState({ available: false, online: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
