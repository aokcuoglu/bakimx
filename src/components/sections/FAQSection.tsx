"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/faq-data";
import {
  LANDING_OBJECTIONS,
  objectionFaqAnchor,
} from "@/lib/landing/objections";

/**
 * Hero şeridindeki 8 itiraz burada da görünür ve metinleri `objections.ts`ten
 * gelir — aynı cümle iki dosyada tutulmaz. Kart tıklandığında `#sss-<id>`
 * çapasına gelinir, o madde de açılır.
 */
const OBJECTION_ENTRIES = LANDING_OBJECTIONS.map((objection) => ({
  value: objectionFaqAnchor(objection.id),
  anchor: objectionFaqAnchor(objection.id),
  question: `“${objection.question}”`,
  answer: objection.answer,
}));

const FAQ_ENTRIES = FAQ_ITEMS.map((faq, index) => ({
  value: `item-${index}`,
  anchor: undefined,
  question: faq.question,
  answer: faq.answer,
}));

/**
 * Adres çubuğundaki `#...` bir DIŞ durum: kartlar `hashchange` ile geliyor ve
 * bileşen bu sırada yeniden mount olmuyor. Effect içinden `setState` çağırmak
 * yerine buraya abone oluyoruz — sunucu anlık görüntüsü boş, dolayısıyla
 * hidrasyonda uyuşmazlık da olmuyor.
 */
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash.slice(1);
const readServerHash = () => "";

function isObjectionAnchor(anchor: string) {
  return OBJECTION_ENTRIES.some((entry) => entry.anchor === anchor);
}

export function FAQSection() {
  const prefersReducedMotion = useReducedMotion();
  const entries = useMemo(() => [...OBJECTION_ENTRIES, ...FAQ_ENTRIES], []);
  const hash = useSyncExternalStore(subscribeToHash, readHash, readServerHash);
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [appliedHash, setAppliedHash] = useState<string | null>(null);

  // Derin link: `#sss-<id>` ile gelindiğinde ilgili madde açılır. Kaydırmayı
  // tarayıcı kendisi yapıyor (çapa gerçek bir DOM `id`), burada yalnız açılma
  // durumu yönetiliyor. Hash değiştiğinde durumu render sırasında düzeltmek
  // React'in önerdiği yol; effect'e göre fazladan bir boyama turu yaratmaz.
  if (hash !== appliedHash) {
    setAppliedHash(hash);
    if (isObjectionAnchor(hash)) setOpenItems([hash]);
  }

  return (
    <section id="sss" className="scroll-mt-24 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-16">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">SSS</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              BakimX hakkında en çok sorulanlar. Aradığınızı bulamadıysanız
              demo talebinde sorunuzu iletebilirsiniz.
            </p>
          </motion.div>
          <div className="lg:col-span-2">
            <Accordion
              className="w-full"
              value={openItems}
              onValueChange={(value) => setOpenItems(value as string[])}
            >
              {entries.map((entry, index) => (
                <motion.div
                  key={entry.value}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                >
                  <AccordionItem
                    id={entry.anchor}
                    value={entry.value}
                    className="mb-3 scroll-mt-24 rounded-lg border bg-card px-5"
                  >
                    <AccordionTrigger className="py-4 text-left text-base font-medium">
                      {entry.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 leading-relaxed text-muted-foreground">
                      {entry.answer}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
