"use client";

import { useEffect, useRef } from "react";

/**
 * Hero fondaki profesyonel parçacık sistemi.
 * 1lookup.io tarzı: küçük daire/çizgi parçacıklar havada süzülür,
 * mouse spotlight yakınında parlaklaşır.
 * - 60 parçacık (pozisyonlar sabit, animasyon CSS)
 * - Spotlight: `--spot-x/y/strength` CSS değişkenleri ile maskelenir
 * - İnce imleç + reduce-motion guard'ı
 */

const DOTS = [
  "5% 12%","12% 45%","18% 8%","22% 62%","28% 32%","32% 78%","38% 15%","42% 55%",
  "48% 88%","52% 22%","58% 68%","62% 42%","68% 8%","72% 58%","78% 35%","82% 72%",
  "88% 18%","92% 48%","95% 82%","8% 92%","15% 38%","25% 72%","35% 18%","45% 65%",
  "55% 38%","65% 82%","75% 12%","85% 55%","95% 35%","3% 55%","18% 88%","28% 5%",
  "38% 48%","48% 25%","58% 78%","68% 42%","78% 68%","88% 28%","92% 72%","8% 32%",
  "22% 15%","32% 58%","42% 85%","52% 12%","62% 48%","72% 78%","82% 22%","92% 58%",
  "10% 65%","30% 32%","50% 72%","70% 15%","90% 42%","15% 78%","35% 55%","55% 8%",
  "75% 48%","85% 85%","20% 42%","60% 25%","40% 68%","80% 12%","45% 45%","65% 65%",
];

const LINES = [
  "5% 18%","15% 55%","25% 28%","35% 72%","45% 42%","55% 82%","65% 18%","75% 55%",
  "85% 32%","95% 68%","8% 45%","28% 85%","48% 15%","68% 58%","88% 42%","12% 78%",
  "32% 22%","52% 65%","72% 8%","92% 55%","18% 42%","38% 78%","58% 28%","78% 62%",
];

export function HeroWorkshop() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const host = root.closest("section") ?? root.parentElement;
    if (!host) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    let frame = 0;
    let running = false;
    let x = 0.62;
    let y = 0.38;
    let strength = 0;
    let targetX = x;
    let targetY = y;
    let targetStrength = 0;

    const render = () => {
      x += (targetX - x) * 0.14;
      y += (targetY - y) * 0.14;
      strength += (targetStrength - strength) * 0.09;
      root.style.setProperty("--spot-x", `${(x * 100).toFixed(3)}%`);
      root.style.setProperty("--spot-y", `${(y * 100).toFixed(3)}%`);
      root.style.setProperty("--spot-strength", strength.toFixed(4));
      const settled =
        Math.abs(targetX - x) < 0.0005 &&
        Math.abs(targetY - y) < 0.0005 &&
        Math.abs(targetStrength - strength) < 0.001;
      if (settled) { running = false; return; }
      frame = requestAnimationFrame(render);
    };

    const wake = () => {
      if (!running) { running = true; frame = requestAnimationFrame(render); }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      targetX = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
      targetY = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
      targetStrength = 1;
      wake();
    };

    const fadeOut = () => { targetStrength = 0; wake(); };

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", fadeOut);
    host.addEventListener("pointercancel", fadeOut);

    return () => {
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", fadeOut);
      host.removeEventListener("pointercancel", fadeOut);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="hero-workshop">
      <div className="hero-workshop-glow" />
      <div className="hero-workshop-grid" />
      <div className="hero-workshop-blob hero-workshop-blob-a" />
      <div className="hero-workshop-blob hero-workshop-blob-b" />

      <div className="hero-workshop-particles">
        {DOTS.map((pos, i) => (
          <span
            key={`d${i}`}
            className="hero-particle hero-particle-dot"
            style={{
              left: pos.split(" ")[0],
              top: pos.split(" ")[1],
              "--particle-delay": `${(i * 1.7) % 18}s`,
              "--particle-dur": `${14 + (i % 7) * 3}s`,
            } as React.CSSProperties}
          />
        ))}
        {LINES.map((pos, i) => (
          <span
            key={`l${i}`}
            className="hero-particle hero-particle-line"
            style={{
              left: pos.split(" ")[0],
              top: pos.split(" ")[1],
              "--particle-delay": `${(i * 2.3) % 20}s`,
              "--particle-dur": `${16 + (i % 5) * 4}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="hero-workshop-halo" />
    </div>
  );
}
