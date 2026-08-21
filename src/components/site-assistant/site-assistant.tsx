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
  setAssistantPanelOpen,
  subscribeAssistantBridge,
} from "./assistant-bridge";

export type AssistantView =
  | "menu"
  | "answers"
  | "chat"
  | "demo"
  | "support"
  | "faq"
  | "success";
export type SuccessContext = "demo" | "support";

const OPEN_KEY = "bakimx.assistant.open";

export function SiteAssistant({ aiEnabled = false }: { aiEnabled?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AssistantView>("menu");
  const [successContext, setSuccessContext] = useState<SuccessContext>("demo");
  const [query, setQuery] = useState("");
  /**
   * Panel hero'daki ask bar'dan mı açıldı? Geçici açılış `localStorage`a
   * YAZILMAZ: bir soru sormak "asistanı kalıcı olarak açık bırak" demek değil,
   * yoksa kullanıcı sonraki ziyaretinde paneli kendiliğinden açık bulurdu.
   */
  const [transient, setTransient] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const bridge = useSyncExternalStore(
    subscribeAssistantBridge,
    getAssistantBridge,
    getServerAssistantBridge,
  );
  const [appliedNonce, setAppliedNonce] = useState(0);
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

  // Ask bar `aria-expanded` için panelin durumunu köprüye bildirir.
  useEffect(() => {
    setAssistantPanelOpen(open);
  }, [open]);

  // Ask bar'dan gelen soru. Nonce'u render sırasında karşılaştırmak effect'e
  // göre fazladan bir boyama turu yaratmaz — `FAQSection`teki hash deseninin
  // aynısı.
  const nonce = bridge.request?.nonce ?? 0;
  if (hydrated && nonce !== appliedNonce) {
    setAppliedNonce(nonce);
    if (bridge.request) {
      setQuery(bridge.request.query);
      setView("answers");
      // Zaten açık bir panel devralınıyorsa geçici sayılmaz: kullanıcı onu
      // kendisi açmıştı, kapatınca tercihi yine kaydedilmeli.
      if (!open) {
        setOpen(true);
        setTransient(true);
      }
    }
  }

  // E-postadaki "sohbete dön" bağlantısı (BAK-99). Ask bar akışının aksine bu
  // GEÇİCİ değil: ziyaretçi görüşmesine döndü, panelin açık kalması beklenir —
  // başka bir sayfaya geçtiğinde de sohbeti açık bulmalı.
  const resumeNonce = bridge.resumeNonce;
  if (hydrated && resumeNonce !== appliedResumeNonce) {
    setAppliedResumeNonce(resumeNonce);
    if (resumeNonce > 0) {
      setView("chat");
      setTransient(false);
      if (!open) {
        setOpen(true);
        persist(true);
      }
    }
  }

  const close = useCallback(() => {
    setOpen(false);
    if (!transient) persist(false);
    setTransient(false);
  }, [transient, persist]);

  if (!isPublicAssistantPath(pathname)) return null;

  return (
    <>
      {/* Ask bar ekrandayken FAB gizlenir — iki asistan girişi aynı anda durmaz. */}
      {!bridge.askBarVisible && (
        <AssistantLauncher
          open={open}
          onClick={() => {
            if (open) {
              close();
            } else {
              setView("menu");
              setOpen(true);
              setTransient(false);
              persist(true);
            }
          }}
        />
      )}
      {open && (
        <AssistantPanel
          view={view}
          successContext={successContext}
          query={query}
          aiEnabled={aiEnabled}
          modal={transient}
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
