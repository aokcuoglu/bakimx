import styles from "./kit.module.css"

/** Numaralı adımlar (e-santral `.move-steps`): beyaz daire içinde mavi sayı. */
export function NumberedSteps({ steps }: { steps: readonly { title: string; text: string }[] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => (
        <li key={step.title} className={styles.step}>
          <b className={styles.stepTitle}>{step.title}</b>
          <span className={styles.stepText}>{step.text}</span>
        </li>
      ))}
    </ol>
  )
}
