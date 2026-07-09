"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isPublicAssistantPath } from "@/lib/site-assistant-visibility";
import { AssistantLauncher } from "./assistant-launcher";
import { AssistantPanel } from "./assistant-panel";

export type AssistantView = "menu" | "demo" | "support" | "faq" | "success";
export type SuccessContext = "demo" | "support";

const OPEN_KEY = "bakimx.assistant.open";

export function SiteAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AssistantView>("menu");
  const [successContext, setSuccessContext] = useState<SuccessContext>("demo");
  const [hydrated, setHydrated] = useState(false);

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

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* yok say */
    }
  }, [open, hydrated]);

  if (!isPublicAssistantPath(pathname)) return null;

  return (
    <>
      <AssistantLauncher
        open={open}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            setView("menu");
            setOpen(true);
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
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
