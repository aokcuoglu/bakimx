"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Qatchup tarzı staggered fade+rise — landing section öğeleri için.
 * H1 / hero’da kullanılmaz (BAK-165 LCP). Aşağıdaki bölümlerde opacity
 * gizlemesi kasıtlıdır; JS kapalıysa layout.tsx noscript kuralı açar.
 */

export const LANDING_EASE = [0.22, 1, 0.36, 1] as const;

const VIEWPORT = {
  once: true,
  amount: 0.2,
  margin: "0px 0px -12% 0px",
} as const;

type StaggerProps = {
  className?: string;
  children: ReactNode;
  /** Daha sıkı stagger aralığı. */
  dense?: boolean;
} & Omit<HTMLMotionProps<"div">, "children" | "className">;

export function LandingStagger({
  className,
  children,
  dense = false,
  ...rest
}: StaggerProps) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <div className={className} data-landing-motion="static">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      data-landing-motion="stagger"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: dense ? 0.08 : 0.11,
            delayChildren: dense ? 0.04 : 0.08,
          },
        },
      }}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type ItemProps = {
  className?: string;
  children: ReactNode;
  /** Pencere / büyük yüzey: scale + daha uzun yol. */
  variant?: "item" | "window";
} & Omit<HTMLMotionProps<"div">, "children" | "className">;

export function LandingItem({
  className,
  children,
  variant = "item",
  ...rest
}: ItemProps) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <div className={className} data-landing-motion="static">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn(className)}
      data-landing-motion="item"
      variants={
        variant === "window"
          ? {
              hidden: { opacity: 0, y: 56, scale: 0.94 },
              show: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 1.15, ease: LANDING_EASE },
              },
            }
          : {
              hidden: { opacity: 0, y: 40 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 1, ease: LANDING_EASE },
              },
            }
      }
      {...rest}
    >
      {children}
    </motion.div>
  );
}
