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
};

/**
 * macOS tarzı trafik ışığı + sürükleme. Landing ürün sahnesi pencereleri için.
 * framer-motion kullanmaz (BAK-165).
 */
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
}: MacWindowProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
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

  const restore = useCallback(() => {
    setClosed(false);
    setMinimized(false);
    setMaximized(false);
    onFocus(id);
  }, [id, onFocus]);

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
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    // Capture başlıkta olmalı: kökte capture edilirse move/up bar handler'larına
    // gelmez ve imleç çubuğu terk edince sürükleme kopar.
    event.currentTarget.setPointerCapture(event.pointerId);
    // CSS left/top (offset*) + translate ofseti sahne içinde kalsın.
    const minX = -el.offsetLeft;
    const maxX = parent.clientWidth - el.offsetWidth - el.offsetLeft;
    const minY = -el.offsetTop;
    const maxY = parent.clientHeight - el.offsetHeight - el.offsetTop;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      minX,
      maxX,
      minY,
      maxY,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    setOffset({
      x: clamp(
        state.originX + (event.clientX - state.startX),
        state.minX,
        state.maxX,
      ),
      y: clamp(
        state.originY + (event.clientY - state.startY),
        state.minY,
        state.maxY,
      ),
    });
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

  const transform =
    draggable && !maximized
      ? `translate3d(${offset.x}px, ${offset.y}px, 0)`
      : undefined;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-labelledby={titleId}
      data-product-window={id}
      data-minimized={minimized ? "true" : "false"}
      data-maximized={maximized ? "true" : "false"}
      className={cn(styles.window, maximized && styles.maximized, className)}
      style={{
        ...style,
        zIndex,
        transform,
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
        <div className={styles.traffic} role="group" aria-label="Pencere kontrolleri">
          <button
            type="button"
            className={`${styles.light} ${styles.close}`}
            aria-label="Kapat"
            title="Kapat"
            onClick={(e) => {
              e.stopPropagation();
              setClosed(true);
            }}
          />
          <button
            type="button"
            className={`${styles.light} ${styles.minimize}`}
            aria-label={minimized ? "Genişlet" : "Simge durumuna küçült"}
            title={minimized ? "Genişlet" : "Simge durumuna küçült"}
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((v) => !v);
              if (maximized) setMaximized(false);
              onFocus(id);
            }}
          />
          <button
            type="button"
            className={`${styles.light} ${styles.maximize}`}
            aria-label={maximized ? "Önceki boyuta dön" : "Büyüt"}
            title={maximized ? "Önceki boyuta dön" : "Büyüt"}
            onClick={(e) => {
              e.stopPropagation();
              setMaximized((v) => !v);
              setMinimized(false);
              onFocus(id);
            }}
          />
        </div>
        <span id={titleId} className={styles.title}>
          {title}
        </span>
        <span className={styles.barSpacer} aria-hidden />
      </div>
      {!minimized && <div className={styles.body}>{children}</div>}
    </div>
  );
}
