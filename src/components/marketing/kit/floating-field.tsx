import type { ComponentProps, ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import styles from "./kit.module.css"

export type FloatingFieldProps = ComponentProps<typeof Input> & {
  label: string
  /** Alanın sağ içinde duran yardımcı öğe (ör. şifre "Göster"). */
  trailing?: ReactNode
}

/**
 * Etiketi alanın içinde, yazınca yukarı kayan form alanı (e-santral `.fl`).
 * `FormControl` (Slot) tarafından verilen `id` / `aria-*` öznitelikleri dahil
 * tüm props `Input`'a geçer; etiket alanı sarmaladığı için ayrıca `htmlFor` gerekmez.
 */
export function FloatingField({ label, trailing, className, ...props }: FloatingFieldProps) {
  return (
    <label className={cn(styles.field, trailing ? styles.fieldWithTrailing : undefined)}>
      <Input {...props} placeholder=" " className={cn(styles.fieldInput, className)} />
      <span className={styles.fieldLabel}>{label}</span>
      {trailing ? <span className={styles.fieldTrailing}>{trailing}</span> : null}
    </label>
  )
}
