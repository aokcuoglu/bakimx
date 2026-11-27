"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isPublicAssistantPath } from "@/lib/site-assistant-visibility";
import dynamic from "next/dynamic";
import { AssistantLauncher } from "./assistant-launcher";

/**
 * Panel ve altındaki tüm görünümler ayrı bir parçaya alınır (BAK-165).
 *
 * Panel zaten yalnız `open` iken render ediliyordu, ama statik `import` onu
 * yine de her sayfanın ilk yüküne sokuyordu; canlı sohbet doğrulaması
 * üzerinden `zod` de (288 kB ham / 51.4 kB br) bu yolla landing paketine
 * giriyordu. Ziyaretçilerin çoğu paneli hiç açmıyor. `ssr: false` doğru:
 * panelin açılışı `localStorage`a bakar, yani sunucuda anlamlı bir çıktısı
 * yok.
 */
const AssistantPanel = dynamic(
  () => import("./assistant-panel").then((m) => m.AssistantPanel),
  { ssr: false },
);
import {
  getAssistantBridge,
  getServerAssistantBridge,
  subscribeAssistantBridge,
} from "./assistant-bridge";

export type AssistantView =
  | "menu"
  | "chat"
  | "demo"
  | "support"
  | "faq"
  | "success";
export type SuccessContext = "demo" | "support";

const OPEN_KEY = "bakimx.assistant.open";

export function SiteAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AssistantView>("menu");
  const [successContext, setSuccessContext] = useState<SuccessContext>("demo");
  const [hydrated, setHydrated] = useState(false);

  const bridge = useSyncExternalStore(
    subscribeAssistantBridge,
    getAssistantBridge,
    getServerAssistantBridge,
  );
  const [appliedResumeNonce, setAppliedResumeNonce] = useState(0);

  const persist = useCallback((next: boolean) => {
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* localStorage erişilemezse yok say */
    }
  }, []);

  // Açık/kapalı durumunu oturumlar arası koru (auto-açılış YOK; ilk ziyaret kapalı).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    try {
      if (localStorage.getItem(OPEN_KEY) === "1") setOpen(true);
    } catch {
      /* localStorage erişilemezse yok say */
    }
  }, []);

  // E-postadaki "sohbete dön" bağlantısı (BAK-99): ziyaretçi görüşmesine döndü, panelin açık kalması beklenir —
  // başka bir sayfaya geçtiğinde de sohbeti açık bulmalı.
  const resumeNonce = bridge.resumeNonce;
  if (hydrated && resumeNonce !== appliedResumeNonce) {
    setAppliedResumeNonce(resumeNonce);
    if (resumeNonce > 0) {
      setView("chat");
      if (!open) {
        setOpen(true);
        persist(true);
      }
    }
  }

  const close = useCallback(() => {
    setOpen(false);
    persist(false);
  }, [persist]);

  if (!isPublicAssistantPath(pathname)) return null;

  return (
    <>
      <AssistantLauncher
        open={open}
        onClick={() => {
          if (open) {
            close();
          } else {
            setView("menu");
            setOpen(true);
            persist(true);
          }
        }}
      />
      {open && (
        <AssistantPanel
          view={view}
          successContext={successContext}
          onNavigate={setView}
          onSuccess={(context) => {
            setSuccessContext(context);
            setView("success");
          }}
          onClose={close}
        />
      )}
    </>
  );
}
