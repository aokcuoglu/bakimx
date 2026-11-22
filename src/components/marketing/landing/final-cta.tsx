import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"
import { cn } from "@/lib/utils"
import { TextLink } from "../kit/text-link"
import { Wordmark } from "../kit/wordmark"
import { CTA, FINAL } from "./content"
import { SignupTrigger } from "./signup-dialog"
import styles from "./landing.module.css"

/** Son çağrı (e-santral `.final`). */
export function FinalCta() {
  return (
    <section className={styles.final} aria-labelledby="final-t">
      <h2 id="final-t" className={styles.finalTitle}>
        <Wordmark variant="inline" />
        {FINAL.titleAfterMark}
      </h2>
      <div className={cn(styles.cta, styles.finalCta)}>
        <SignupTrigger variant="pill-lg" location="final">
          {CTA.trial}
        </SignupTrigger>
        <TextLink href={getSupportWhatsAppUrl(FINAL.whatsappMessage)} external>
          {FINAL.whatsapp}
        </TextLink>
      </div>
    </section>
  )
}
