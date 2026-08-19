"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestLiveChatResume } from "@/components/site-assistant/assistant-bridge";
import { adoptLiveChatToken } from "@/components/site-assistant/use-live-chat";

/**
 * Devam bağlantısının istemci ucu (BAK-99).
 *
 * Sunucu tarafı süreli token'ı çözdü; burada görüşmenin anahtarı bu tarayıcıya
 * yerleştirilir ve asistan paneli sohbet görünümünde açılır. Bağlantı başka bir
 * cihazda/tarayıcıda açılacağı için `localStorage`'da anahtar yoktur — bu adım
 * onu koyan tek yerdir.
 *
 * Panel `SiteAssistant` içinde kök layout'ta yaşıyor; bu sayfadan ona köprü
 * üzerinden haber verilir (aynı desen hero'daki ask bar'da da kullanılıyor).
 */
export function ResumeChatOpener({ conversationToken }: { conversationToken: string }) {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    adoptLiveChatToken(conversationToken);
    requestLiveChatResume();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpened(true);
  }, [conversationToken]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {opened
          ? "Görüşmeniz destek panelinde açıldı. Panel kapandıysa aşağıdaki düğmeyle yeniden açabilirsiniz."
          : "Görüşmeniz açılıyor…"}
      </p>
      <Button
        onClick={() => {
          adoptLiveChatToken(conversationToken);
          requestLiveChatResume();
        }}
      >
        <MessageCircle />
        Sohbeti aç
      </Button>
    </div>
  );
}
