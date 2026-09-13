"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, inView, motion, useScroll } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ScrollToTopButton } from "@/components/site-assistant/scroll-to-top-button";
import styles from "./public-site.module.css";

/** Public website only. Server-rendered children are always visible. */
export function PublicSite({
  children,
  editorial = false,
  customLayout = false,
}: {
  children: ReactNode;
  editorial?: boolean;
  /** Specialized public pages keep their own typography and sticky layout. */
  customLayout?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();
  useEffect(() => {
    if (root.current) root.current.dataset.publicReady = "true";
    if (!root.current || reduced) return;
    const animations: ReturnType<typeof animate>[] = [];
    const sections = Array.from(
      root.current.querySelectorAll<HTMLElement>("main > section"),
    ).filter((section) => !["hero", "ozellikler"].includes(section.id));
    const cleanups = sections.map((section) =>
      inView(
        section,
        () => {
          section.dataset.motionSection = "entered";
          animations.push(
            animate(
              section,
              { y: [36, 0] },
              { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
            ),
          );
        },
        { margin: "0px 0px -60px 0px", amount: "some" },
      ),
    );
    return () => {
      cleanups.forEach((stop) => stop());
      animations.forEach((animation) => animation.stop());
      sections.forEach((section) => section.style.removeProperty("transform"));
    };
  }, [reduced]);
  return (
    <div
      ref={root}
      className={customLayout ? styles.customSite : styles.site}
      data-public-site
      data-editorial={editorial || undefined}
    >
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
