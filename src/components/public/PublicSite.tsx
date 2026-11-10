"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useScroll } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ScrollToTopButton } from "@/components/site-assistant/scroll-to-top-button";
import styles from "./public-site.module.css";

/** Public website only. Server-rendered children are always visible. */
export function PublicSite({
  children,
  editorial = false,
  customLayout = false,
  landing = false,
  frame = true,
}: {
  children: ReactNode;
  editorial?: boolean;
  /** Specialized public pages keep their own typography and sticky layout. */
  customLayout?: boolean;
  /** Adds the shared landing-page frame without affecting other public pages. */
  landing?: boolean;
  /**
   * When `landing` is on, draw the 1124px decorative rail.
   * Blog index supplies its own 1124px content rails — turn this off there
   * so the two frames do not nest.
   */
  frame?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();
  useEffect(() => {
    if (root.current) root.current.dataset.publicReady = "true";
  }, []);
  return (
    <div
      ref={root}
      className={landing ? styles.landingSite : customLayout ? styles.customSite : styles.site}
      data-public-site
      data-editorial={editorial || undefined}
      data-landing={landing || undefined}
    >
      {landing && frame ? <div className={styles.landingFrame} aria-hidden="true" /> : null}
      {!reduced && (
        <motion.div
          aria-hidden
          className={styles.progress}
          style={{ scaleX: scrollYProgress }}
        />
      )}
      <ScrollToTopButton />
      {children}
    </div>
  );
}
