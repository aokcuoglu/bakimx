import { PillButton } from "./pill-button"
import styles from "./kit.module.css"

export type SuccessStateProps = {
  titleId: string
  title: string
  text: string
  onDone: () => void
}

/** Gönderim sonrası onay görünümü (e-santral `.m-done`). */
export function SuccessState({ titleId, title, text, onDone }: SuccessStateProps) {
  return (
    <div className={styles.done} role="status">
      <span className={styles.doneIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <h2 id={titleId} className={styles.dialogHeading}>
        {title}
      </h2>
      <p className={styles.dialogLead}>{text}</p>
      <PillButton size="lg" onClick={() => onDone()} className={styles.doneButton}>
        Tamam
      </PillButton>
    </div>
  )
}
