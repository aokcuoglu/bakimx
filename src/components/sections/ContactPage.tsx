"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { contactSchema } from "@/lib/validations/contact"
import styles from "./contact-page.module.css"
import { EmailAddress } from "@/components/shared/email-address"

type Values = z.infer<typeof contactSchema>

export function ContactPage() {
  const [success, setSuccess] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", title: "", businessName: "", referral: "", message: "" },
  })

  async function onSubmit(values: Values) {
    setGeneralError(null)
    try {
      const response = await fetch("/api/support-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          businessName: values.businessName,
          email: values.email,
          phone: values.phone,
          subject: `${values.title} · ${values.referral}`,
          message: values.message,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setGeneralError(result?.errors?._general ?? "Mesajınız gönderilemedi. Lütfen tekrar deneyin.")
        return
      }
      setSuccess(true)
      form.reset()
    } catch {
      setGeneralError("Bağlantı hatası oluştu. Lütfen tekrar deneyin.")
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <section className={styles.intro} aria-labelledby="contact-title">
          <Image
            className={styles.illustration}
            src="/illustrations/contact-auto-service-navy.png"
            alt="Dijital araç kabulü, kontrol listesi ve servis liftindeki aracı anlatan illüstrasyon"
            width={768}
            height={512}
            priority
          />
          <h1 id="contact-title">Bizimle iletişime geçin.</h1>
          <p className={styles.lead}>
            BakımX hakkında merak ettiklerinizi paylaşın. Ekibimiz, servisiniz için en doğru yolu birlikte bulmanıza yardımcı olsun.
          </p>
          <div className={styles.contactDetails}>
            <span>E-posta</span>
            <EmailAddress address="hey@bakimx.com" />
            <span className={styles.socialHint}>Bizi takip edin</span>
            <div className={styles.socials} aria-label="Sosyal medya bağlantıları">
              <a href="https://www.linkedin.com/company/bakimx/" target="_blank" rel="noreferrer" aria-label="LinkedIn">in</a>
              <a href="https://www.instagram.com/bakimxcom" target="_blank" rel="noreferrer" aria-label="Instagram">ig</a>
              <a href="https://x.com/bakimxcom" target="_blank" rel="noreferrer" aria-label="X">𝕏</a>
            </div>
          </div>
        </section>

        <section className={styles.formPanel} aria-labelledby="form-title">
          <div className={styles.formHeader}>
            <p className={styles.eyebrow}>İletişim formu</p>
            <h2 id="form-title">Size nasıl yardımcı olabiliriz?</h2>
          </div>
          {success ? (
            <Alert variant="success" className="mt-8">
              <AlertDescription className="text-success-strong">Mesajınız bize ulaştı. Ekibimiz en kısa sürede sizinle iletişime geçecek.</AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
                {generalError && <Alert variant="destructive"><AlertDescription>{generalError}</AlertDescription></Alert>}
                <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Ad Soyad</FormLabel><FormControl><Input placeholder="Ahmet Yılmaz" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>E-posta</FormLabel><FormControl><Input type="email" inputMode="email" placeholder="ornek@servis.com" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="phone" render={({ field }) => <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input inputMode="tel" placeholder="0532 123 4567" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Ünvan</FormLabel><FormControl><Input placeholder="Servis sahibi" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="businessName" render={({ field }) => <FormItem><FormLabel>Şirket / Servis adı</FormLabel><FormControl><Input placeholder="Örnek Oto Servis" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="referral" render={({ field }) => <FormItem><FormLabel>Bizi nasıl duydunuz?</FormLabel><FormControl><Input placeholder="LinkedIn, tavsiye, arama…" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="message" render={({ field }) => <FormItem><FormLabel>Mesajınız</FormLabel><FormControl><Textarea rows={4} placeholder="Kısaca ne hakkında konuşmak istersiniz?" {...field} /></FormControl><FormMessage /></FormItem>} />
                <p className={styles.consent}>Formu göndererek <Link href="/privacy">gizlilik ve çerez politikamızı</Link> okuduğunuzu kabul edersiniz.</p>
                <Button type="submit" variant="navy" size="xl" className="h-7 w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <><Loader2 className="animate-spin" /> Gönderiliyor…</> : "Gönder"}
                </Button>
              </form>
            </Form>
          )}
        </section>
      </div>
    </main>
  )
}
