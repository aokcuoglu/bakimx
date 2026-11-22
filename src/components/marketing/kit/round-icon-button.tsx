import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import styles from "./kit.module.css"

export type RoundIconButtonProps = Omit<ComponentProps<typeof Button>, "size" | "variant" | "aria-label"> & {
  /** Erişilebilir ad — düğmede görünür metin yok. */
  label: string
  size?: 44 | 32
}

/** Nötr yuvarlak ikon düğmesi (e-santral `.d-arrow` 44px, `.m-x` 32px). */
export function RoundIconButton({ label, size = 44, className, type = "button", ...props }: RoundIconButtonProps) {
  return (
    <Button
      {...props}
      type={type}
      variant="secondary"
      size="icon"
      aria-label={label}
      className={cn(styles.round, size === 32 && styles.round32, className)}
    />
  )
}
