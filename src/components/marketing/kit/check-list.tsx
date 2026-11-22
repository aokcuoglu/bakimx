import styles from "./kit.module.css"

/** Mavi tikli dahil listesi (e-santral `.incl`). */
export function CheckList({ items }: { items: readonly string[] }) {
  return (
    <ul className={styles.checks}>
      {items.map((item) => (
        <li key={item} className={styles.check}>
          {item}
        </li>
      ))}
    </ul>
  )
}
