"use client";

import { ViewHeader } from "./view-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/faq-data";

interface FaqViewProps {
  onBack: () => void;
}

export function FaqView({ onBack }: FaqViewProps) {
  return (
    <div className="space-y-3 p-4">
      <ViewHeader title="Sık Sorulanlar" onBack={onBack} />
      <Accordion type="multiple" className="w-full">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`q-${i}`}>
            <AccordionTrigger>
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="leading-relaxed text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
