import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const primaryFill =
  "bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_-2px_rgba(38,109,240,0.12),0_3px_6px_-2px_rgba(38,109,240,0.08)] hover:bg-primary/90"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[8px] border-0 bg-clip-padding font-sans text-center text-sm font-medium leading-5 tracking-[-0.07px] whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: primaryFill,
        inverse:
          "border-navy-foreground bg-navy-foreground text-navy hover:bg-navy-foreground/90 hover:text-navy focus-visible:ring-navy-foreground/50",
        foreground: primaryFill,
        navy: primaryFill,
        whatsapp: "bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90",
        outline:
          "border-transparent bg-card text-foreground shadow-[0_0_2px_rgba(28,40,64,0.18),0_1px_3px_rgba(0,0,0,0.04)] hover:bg-muted aria-expanded:bg-muted dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-[rgba(0,0,0,0.55)] hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:text-muted-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive-strong hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        success:
          "bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/20",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-7 gap-1 py-1 pr-2 pl-1.5",
        xs: "h-5 gap-1 rounded-[6px] px-1.5 py-0.5 text-xs leading-4 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 py-1 pr-2 pl-1.5",
        lg: "h-7 gap-1 py-1 pr-2 pl-1.5",
        xl: "h-7 gap-1 py-1 pr-2 pl-1.5",
        compact: "h-5 gap-1 rounded-[6px] px-1.5 text-xs",
        icon: "size-7",
        "icon-xs": "size-5 rounded-[6px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-7",
        "icon-compact": "size-5 rounded-[6px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
