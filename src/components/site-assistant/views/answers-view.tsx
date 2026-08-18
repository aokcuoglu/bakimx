"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, CalendarCheck, LifeBuoy, MessagesSquare, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandSpinner } from "@/components/shared/brand-spinner";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { matchAssistantAnswers } from "@/lib/landing/assistant-answers";
import { useLiveChatBadge } from "../use-live-chat-badge";
import { ViewHeader } from "./view-header";
import type { AssistantView } from "../site-assistant";

interface AnswersViewProps {
  /** Ask bar'a yazılan ham metin. */
  query: string;
  aiEnabled: boolean;
  onBack: () => void;
  onNavigate: (view: AssistantView) => void;
}

/**
 * Ask bar'dan gelen sorunun karşılığı (BAK-81 yaklaşım A, BAK-92 yaklaşım B).
 *
 * Bayrak kapalıyken cevaplar yalnız `matchAssistantAnswers` ile seçilir ve ağ
 * isteği yapılmaz. Açıkken kaynaklı tek AI yanıtı denenir; her hata durumunda
 * aynı yerel eşleştiriciye dönülür.
 */
type AiResponse =
  | { success: true; mode: "fallback" }
  | { success: true; mode: "ai"; answer: string; sources: ReturnType<typeof matchAssistantAnswers> }
  | { success: false };

export function AnswersView({ query, aiEnabled, onBack, onNavigate }: AnswersViewProps) {
  const fallbackAnswers = useMemo(() => matchAssistantAnswers(query), [query]);
  const [aiState, setAiState] = useState<{
    query: string;
    answer: { answer: string; sources: ReturnType<typeof matchAssistantAnswers> } | null;
  } | null>(null);

  useEffect(() => {
    if (!aiEnabled) return;

    const controller = new AbortController();
    void fetch("/api/assistant/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: query }),
      signal: controller.signal,
    })
      .then(async (response) => response.json() as Promise<AiResponse>)
      .then((result) => {
        if (result.success && result.mode === "ai") {
          setAiState({ query, answer: { answer: result.answer, sources: result.sources } });
        } else {
          setAiState({ query, answer: null });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setAiState({ query, answer: null });
      });
    return () => controller.abort();
  }, [aiEnabled, query]);

  const loading = aiEnabled && aiState?.query !== query;
  const aiAnswer = aiState?.query === query ? aiState.answer : null;
  const answers = aiAnswer?.sources ?? fallbackAnswers;
  const badge = useLiveChatBadge();
  const empty = !loading && answers.length === 0;

  return (
    <div className="space-y-4 p-4">
      <ViewHeader title="Sorunuzun yanıtı" onBack={onBack} />

      <div className="rounded-2xl bg-muted/60 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Sorunuz</p>
        <p className="mt-0.5 text-sm leading-relaxed text-foreground">{query}</p>
      </div>

      {loading ? (
        <div className="flex min-h-28 items-center justify-center rounded-xl border">
          <BrandSpinner size={36} label="Yanıt hazırlanıyor…" />
        </div>
      ) : empty ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-dashed px-3.5 py-3">
          <SearchX aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Bu soruya hazır bir yanıtımız yok. Ekibimize iletelim; size doğrudan
            dönelim.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {aiAnswer && (
            <div className="rounded-xl border bg-card p-3.5">
              <p className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />
                <span>{aiAnswer.answer}</span>
              </p>
            </div>
          )}
          {aiAnswer && <p className="text-xs font-medium text-muted-foreground">Yanıt kaynağı</p>}
          <ul className="space-y-2.5">
          {answers.map((answer) => (
            <li key={`${answer.source}-${answer.id}`} className="rounded-xl border bg-card p-3.5">
              <p className="text-sm font-semibold leading-snug text-foreground">
                {answer.source === "objection" ? `“${answer.question}”` : answer.question}
              </p>
              {!aiAnswer && (
                <>
                  <Separator className="my-2.5" />
                  <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                    <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success-strong" />
                    <span>{answer.answer}</span>
                  </p>
                </>
              )}
              {answer.href && (
                <a
                  href={answer.href}
                  className="mt-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                >
                  Ayrıntılı yanıt
                  <ChevronRight aria-hidden className="size-3.5" />
                </a>
              )}
            </li>
          ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {!empty && !loading && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Aradığınız yanıt bu değil mi?
          </p>
        )}
        {badge?.available && (
          <FallbackAction
            icon={MessagesSquare}
            label="Canlı destek"
            description="Ekibimizle şimdi yazışın"
            emphasis={empty}
            onClick={() => onNavigate("chat")}
            trailing={
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  badge.online ? "bg-success/15 text-success-strong" : "bg-muted text-muted-foreground",
                )}
              >
                {badge.online ? "Çevrimiçi" : "Çevrimdışı"}
              </span>
            }
          />
        )}
        <FallbackAction
          icon={CalendarCheck}
          label="Demo talep et"
          description="Size özel canlı tanıtım ayarlayalım"
          emphasis={empty}
          onClick={() => onNavigate("demo")}
        />
        <FallbackAction
          icon={LifeBuoy}
          label="Destek / İletişim"
          description="Sorunuzu ekibimize iletelim"
          emphasis={empty}
          onClick={() => onNavigate("support")}
        />
      </div>
    </div>
  );
}

// `md:h-auto` şart: Button size varyantındaki `md:h-9` twMerge'de `h-auto` ile
// aynı gruba düşmediği için md+ ekranda satırı 36px'e sabitler ve `p-3` ölü kalır.
const ROW_CLASS =
  "h-auto w-full justify-start gap-3 whitespace-normal rounded-xl p-3 text-left md:h-auto " +
  "hover:border-primary/40 hover:bg-primary/5";

function FallbackAction({
  icon: Icon,
  label,
  description,
  emphasis,
  onClick,
  trailing,
}: {
  icon: typeof LifeBuoy;
  label: string;
  description: string;
  /** Eşleşme yokken bu satırlar tek yol olduğu için biraz daha belirgin durur. */
  emphasis: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(ROW_CLASS, emphasis && "border-primary/40 bg-primary/5")}
      onClick={onClick}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover/button:bg-primary/15">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-medium leading-tight text-foreground">{label}</span>
        <span className="block truncate text-xs leading-tight text-muted-foreground">{description}</span>
      </span>
      {trailing}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover/button:translate-x-0.5" />
    </Button>
  );
}
