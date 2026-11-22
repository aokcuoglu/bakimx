import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import styles from "./kit.module.css"

/** Yalnız alt çizgili SSS akordeonu (e-santral `.faq`); tek seferde bir soru açık. */
export function FaqAccordion({ items }: { items: readonly { question: string; answer: string }[] }) {
  return (
    <Accordion type="single" collapsible className={styles.faq}>
      {items.map((item, index) => (
        <AccordionItem key={item.question} value={`faq-${index}`} className={styles.faqItem}>
          <AccordionTrigger className={styles.faqTrigger}>{item.question}</AccordionTrigger>
          <AccordionContent className={styles.faqContent}>
            <p className={styles.faqAnswer}>{item.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
