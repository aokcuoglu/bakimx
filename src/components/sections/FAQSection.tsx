"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/shared/SectionHeading";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "BakimX mobilde çalışır mı?",
    answer:
      "Evet, BakimX tamamen mobil öncelikli tasarlanmıştır. Telefonunuzdan kolayca araç kabul formu doldurabilir, fotoğraf çekebilir ve hasar işaretleyebilirsiniz. Masaüstü cihazlardan da erişim mümkündür.",
  },
  {
    question: "Küçük oto tamircileri için uygun mu?",
    answer:
      "Kesinlikle. BakimX, küçük ve orta ölçekli oto tamir atölyeleri için tasarlanmıştır. Tek kişilik kullanıma uygundur ve kurulum için teknik bilgi gerektirmez.",
  },
  {
    question: "Müşteriye WhatsApp ile çıktı gönderilebilir mi?",
    answer:
      "Evet. Araç kabul tutanağını profesyonel bir formatla WhatsApp üzerinden doğrudan müşteriye gönderebilirsiniz. Ayrıca PDF formatında da çıktı alabilirsiniz.",
  },
  {
    question: "Nasıl başlarım? Ücretsiz deneme var mı?",
    answer:
      "\"Ücretsiz Dene\" diyerek iş yeri bilgilerinizle hesabınızı oluşturursunuz. Hesabınız onaylandığında 15 günlük ücretsiz deneme süreniz başlar ve tüm özellikleri kredi kartı gerekmeden kullanırsınız. Beğenirseniz size uygun pakete geçersiniz; istemezseniz herhangi bir ücret ödemezsiniz.",
  },
  {
    question: "Kurulum için bilgisayar gerekir mi?",
    answer:
      "Hayır. BakimX tarayıcı tabanlı bir platformdur. Telefonunuzun internet tarayıcısından doğrudan erişebilirsiniz. Herhangi bir kurulum veya indirme gerekmez.",
  },
];

export function FAQSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="sss" className="py-16 sm:py-24 bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
        >
          <SectionHeading
            badge="SSS"
            title="Sık Sorulan Sorular"
            subtitle="BakimX hakkında merak edilenler."
          />
        </motion.div>
        <div className="mt-12">
          <Accordion className="w-full">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
              >
                <AccordionItem value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-base font-medium py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}