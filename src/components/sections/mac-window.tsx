"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import styles from "./mac-window.module.css";

export type MacWindowApi = {
  id: string;
  closed: boolean;
  restore: () => void;
};

type MacWindowProps = {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  /** CSS ile verilen başlangıç konumu (top/left/right/width). */
  style?: CSSProperties;
  zIndex: number;
  onFocus: (id: string) => void;
  onApi?: (api: MacWindowApi) => void;
  /** Mobilde sürükleme kapalı — parent stacked layout kullanır. */
  draggable?: boolean;
  /**
   * Ürün sahnesi scroll-linked ofseti (DESIGN.md Motion denemesi).
   * Sürükleme ofsetiyle toplanır; `initial={false}` — SSR’da opacity gizlemez.
   */
  scrollY?: MotionValue<number>;
  scrollScale?: MotionValue<number>;
};

function clamp(value: number, min: number, max: number) {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

export function MacWindow({
  id,
  title,
  children,
  className,
  style,
  zIndex,
  onFocus,
  onApi,
  draggable = true,
  scrollY,
  scrollScale,
}: MacWindowProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const zeroScrollY = useMotionValue(0);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [closed, setClosed] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);

  const resolvedScrollY = scrollY ?? zeroScrollY;
  const composedY = useTransform(
    [dragY, resolvedScrollY],
    ([dragOffset, scrollOffset]: number[]) => dragOffset + scrollOffset,
  );

  const restore = useCallback(() => {
    setClosed(false);
    setMinimized(false);
    setMaximized(false);
    dragX.set(0);
    dragY.set(0);
    onFocus(id);
  }, [dragX, dragY, id, onFocus]);

  useEffect(() => {
    onApi?.({ id, closed, restore });
  }, [id, closed, restore, onApi]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggable || maximized) return;
    // Yalnız başlık çubuğundan sürükle; trafik ışığına basınca sürükleme.
    if ((event.target as HTMLElement).closest(`.${styles.traffic}`)) return;
    // Sol tık / birincil pointer; dokunmatik ve kalem de primary sayılır.
    if (event.button !== 0) return;
    onFocus(id);
    const el = rootRef.current;
    const parent = el?.closest<HTMLElement>("[data-product-stage-bounds]");
    if (!el || !parent) return;
    // Capture başlıkta olmalı: kökte capture edilirse move/up bar handler'larına
    // gelmez ve imleç çubuğu terk edince sürükleme kopar.
    event.currentTarget.setPointerCapture(event.pointerId);
    // Reveal wrappers are window-sized; clamp against the whole product stage.
    const bounds = parent.getBoundingClientRect();
    const windowBounds = el.getBoundingClientRect();
    const minX = dragX.get() + bounds.left - windowBounds.left;
    const maxX = dragX.get() + bounds.right - windowBounds.right;
    const minY = dragY.get() + bounds.top - windowBounds.top;
    const maxY = dragY.get() + bounds.bottom - windowBounds.bottom;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: dragX.get(),
      originY: dragY.get(),
      minX,
      maxX,
      minY,
      maxY,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    dragX.set(
      clamp(
        state.originX + (event.clientX - state.startX),
        state.minX,
        state.maxX,
      ),
    );
    dragY.set(
      clamp(
        state.originY + (event.clientY - state.startY),
        state.minY,
        state.maxY,
      ),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (closed) return null;

  const canDrag = draggable && !maximized;

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-labelledby={titleId}
      data-product-window={id}
      data-minimized={minimized ? "true" : "false"}
      data-maximized={maximized ? "true" : "false"}
      className={cn(styles.window, maximized && styles.maximized, className)}
      initial={false}
      style={{
        ...style,
        zIndex,
        x: canDrag ? dragX : 0,
        y: maximized ? 0 : composedY,
        scale: !maximized && scrollScale ? scrollScale : 1,
      }}
      onPointerDown={() => onFocus(id)}
    >
      <div
        className={styles.bar}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className={styles.traffic}
          role="group"
          aria-label="Pencere kontrolleri"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className={`${styles.light} ${styles.close}`}
                aria-label="Kapat"
                onClick={(e) => {
                  e.stopPropagation();
                  setClosed(true);
                }}
              />
            </TooltipTrigger>
            <TooltipContent>Kapat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className={`${styles.light} ${styles.minimize}`}
                aria-label={minimized ? "Genişlet" : "Simge durumuna küçült"}
                onClick={(e) => {
                  e.stopPropagation();
                  setMinimized((v) => !v);
                  if (maximized) setMaximized(false);
                  onFocus(id);
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {minimized ? "Genişlet" : "Simge durumuna küçült"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className={`${styles.light} ${styles.maximize}`}
                aria-label={maximized ? "Önceki boyuta dön" : "Büyüt"}
                onClick={(e) => {
                  e.stopPropagation();
                  setMaximized((v) => !v);
                  setMinimized(false);
                  onFocus(id);
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {maximized ? "Önceki boyuta dön" : "Büyüt"}
            </TooltipContent>
          </Tooltip>
        </div>
        <span id={titleId} className={styles.title}>
          {title}
        </span>
        <span className={styles.barSpacer} aria-hidden />
      </div>
      {!minimized && (
        <div
          tabIndex={0}
          role="region"
          aria-label={`${title} içeriği`}
          className={styles.body}
        >
          {children}
        </div>
      )}
    </motion.div>
  );
}
