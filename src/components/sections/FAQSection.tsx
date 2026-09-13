"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LANDING_FAQ_ITEMS } from "@/lib/faq-data";

// LANDING_OBJECTIONS remains the source for hero question chips and the assistant;
// the landing SSS uses the shorter, service-focused FAQ selection below.
const FAQ_ENTRIES = LANDING_FAQ_ITEMS.map((faq, index) => ({
  value: `item-${index}`,
  anchor: undefined,
  question: faq.landingQuestion ?? faq.question,
  answer: faq.answer,
}));
export function FAQSection() {
  const [openItems, setOpenItems] = useState<string[]>([]);
  return (
    <section id="sss" className="scroll-mt-24 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Aklınızda soru kalmasın
            </p>
            <h2 className="max-w-sm text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-navy sm:text-5xl">
              Başlamadan önce.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
              Programı, geçiş sürecini ve günlük kullanımı merak etmeniz doğal.
            </p>
          </div>
          <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
            className="grid items-start"
          >
            {FAQ_ENTRIES.map((entry) => (
              <AccordionItem
                key={entry.value}
                id={entry.anchor}
                value={entry.value}
                className="scroll-mt-28 border-b first:border-t"
              >
                <AccordionTrigger className="py-5 text-left text-sm font-medium leading-6 text-navy sm:text-base">
                  {entry.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl pb-5 text-sm leading-7 text-muted-foreground">
                  {entry.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
