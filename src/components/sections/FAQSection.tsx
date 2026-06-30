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
      "Evet, BakimX tamamen mobil öncelikli tasarlanmıştır. Telefonunuzdan araç kabul edebilir, fotoğraf çekebilir, iş emri ve teklif oluşturabilirsiniz. Masaüstü cihazlardan da erişim mümkündür.",
  },
  {
    question: "Hangi modüller bugün hazır?",
    answer:
      "İş emri, teklif, randevu, takvim, stok/parça, tedarikçi, kasa (tahsilat ve yaşlandırma), müşteri & araç yönetimi, bakım hatırlatmaları, raporlar ve iletişim modülleri bugün kullanıma hazırdır. AI servis danışmanı Premium pakette yer alır.",
  },
  {
    question: "Stok, tedarikçi ve tahsilat takibi var mı?",
    answer:
      "Evet. Parça stoğunuzu kritik eşiklerle takip eder, tedarikçilerinizi yönetir, tahsilatları kasada toplar ve yaşlandırma (alacak) raporu alırsınız.",
  },
  {
    question: "Müşteriye WhatsApp ile çıktı gönderilebilir mi?",
    answer:
      "Evet. Teklif ve iş emri özetini WhatsApp veya link ile doğrudan müşteriye gönderebilir, tarayıcıdan yazdırabilirsiniz. Markalı PDF dışa aktarma yakında ekleniyor.",
  },
  {
    question: "Birden fazla kullanıcı ekleyebilir miyim?",
    answer:
      "Evet. Ekibinizi davet edip rol verebilirsiniz; teknisyen, servis danışmanı ve yönetici farklı yetkilerle çalışır.",
  },
  {
    question: "Verilerim güvende mi?",
    answer:
      "Her servis yalnızca kendi verisini görür ve erişim rol bazlıdır (sahip / yönetici / personel). Platform KVKK uyumlu olacak şekilde geliştiriliyor.",
  },
  {
    question: "Küçük oto tamircileri için uygun mu?",
    answer:
      "Kesinlikle. BakimX, küçük ve orta ölçekli oto tamir atölyeleri için tasarlanmıştır. Tek kişilik kullanıma uygundur ve kurulum için teknik bilgi gerektirmez.",
  },
  {
    question: "Nasıl başlarım? Ücretsiz deneme var mı?",
    answer:
      "\"Ücretsiz Dene\" diyerek iş yeri bilgilerinizle başvurunuzu oluşturursunuz. Başvurunuz onaylandığında 15 günlük ücretsiz deneme süreniz başlar ve özellikleri kredi kartı gerekmeden kullanırsınız. Beğenirseniz size uygun pakete geçersiniz; istemezseniz herhangi bir ücret ödemezsiniz.",
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