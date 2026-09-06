"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LANDING_FAQ_ITEMS } from "@/lib/faq-data";
import {
  LANDING_OBJECTIONS,
  objectionFaqAnchor,
} from "@/lib/landing/objections";

const OBJECTION_ENTRIES = LANDING_OBJECTIONS.map((objection) => ({
  value: objectionFaqAnchor(objection.id),
  anchor: objectionFaqAnchor(objection.id),
  question: `“${objection.question}”`,
  answer: objection.answer,
}));
const FAQ_ENTRIES = LANDING_FAQ_ITEMS.map((faq, index) => ({
  value: `item-${index}`,
  anchor: undefined,
  question: faq.question,
  answer: faq.answer,
}));
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash.slice(1);
const readServerHash = () => "";

export function FAQSection() {
  const hash = useSyncExternalStore(subscribeToHash, readHash, readServerHash);
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [appliedHash, setAppliedHash] = useState<string | null>(null);
  if (hash !== appliedHash) {
    setAppliedHash(hash);
    if (OBJECTION_ENTRIES.some((entry) => entry.anchor === hash))
      setOpenItems([hash]);
  }
  return (
    <section id="sss" className="scroll-mt-24 bg-card py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Aklınızda soru kalmasın
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-navy sm:text-4xl">
            Başlamadan önce.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Programı, geçiş sürecini ve günlük kullanımı merak etmeniz doğal.
          </p>
        </div>
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
          className="grid items-start gap-x-16 lg:grid-cols-2"
        >
          {[
            { title: "BakımX hakkında", entries: FAQ_ENTRIES },
            { title: "Serviste nasıl kullanırım?", entries: OBJECTION_ENTRIES },
          ].map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 border-b pb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              {group.entries.map((entry) => (
                <AccordionItem
                  key={entry.value}
                  id={entry.anchor}
                  value={entry.value}
                  className="scroll-mt-28 border-b"
                >
                  <AccordionTrigger className="py-4 text-left text-sm font-medium leading-6 text-navy">
                    {entry.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-7 text-muted-foreground">
                    {entry.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
