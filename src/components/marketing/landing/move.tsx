import { Reveal } from "@/components/shared/reveal"
import { NumberedSteps } from "../kit/numbered-steps"
import { CallbackTrigger } from "./callback-dialog"
import { CTA, MOVE } from "./content"
import { SignupTrigger } from "./signup-dialog"
import styles from "./landing.module.css"

/** Geçiş ve görüşme (e-santral `#gecis`). */
export function Move() {
  return (
    <section id="gecis" className={styles.sec} aria-labelledby="gecis-t">
      <div className={styles.wrap}>
        <Reveal className={styles.move}>
          <div>
            <h2 id="gecis-t" className={styles.moveTitle}>
              {MOVE.title} <span className={styles.dim}>{MOVE.dim}</span>
            </h2>
            <p className={styles.moveText}>{MOVE.text}</p>
            <div className={styles.moveCta}>
              <CallbackTrigger variant="pill-lg" location="move_primary">
                {CTA.callback}
              </CallbackTrigger>
              <SignupTrigger variant="text" location="move_secondary">
                {CTA.trial}
              </SignupTrigger>
            </div>
          </div>
          <NumberedSteps steps={MOVE.steps} />
        </Reveal>
      </div>
    </section>
  )
}
