"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * Görünüm alanına girince bir kez oynayan beliriş animasyonu — landing
 * section'larındaki `framer-motion` `whileInView` kullanımının yerini alır
 * (BAK-165).
 *
 * Neden kendi bileşenimiz: `whileInView` tek başına framer-motion'ın tamamını
 * (132 kB ham / 37.8 kB br) landing'in ilk yüküne sokuyordu ve `initial`
 * değerini sunucu HTML'ine satır içi `opacity:0` olarak basarak içeriği
 * hidrasyona kadar görünmez bırakıyordu. Buradaki iş bir IntersectionObserver'a
 * iniyor; animasyonun kendisi `globals.css`te (`reveal-in`).
 *
 * `data-reveal` SUNUCUDA `pending` basılır. Bunu istemcide sonradan eklemek
 * daha "ilerici" görünürdü ama SSR çıktısı zaten boyanmış olurdu, yani öge
 * önce görünüp sonra gizlenir ve her kartta bir titreme kalırdı. Gizliliği
 * geri alan iki kaçış yolu da JS gerektirmez: hareket azaltma tercihi (media
 * query hiç eşleşmez) ve JS kapalıyken `layout.tsx`teki `<noscript>` kuralı.
 */
type RevealDirection = "up" | "left" | "right" | "fade";

const DIRECTION_VARS: Record<RevealDirection, CSSProperties> = {
  up: {},
  left: { "--reveal-x": "-1rem", "--reveal-y": "0" } as CSSProperties,
  right: { "--reveal-x": "1rem", "--reveal-y": "0" } as CSSProperties,
  fade: { "--reveal-x": "0", "--reveal-y": "0" } as CSSProperties,
};

type RevealProps<T extends ElementType> = {
  as?: T;
  /** Başlangıç yönü; `fade` yalnız opaklık değiştirir. */
  from?: RevealDirection;
  /** Kademeli giriş gecikmesi (ms). */
  delay?: number;
  /** Animasyonun tetiklenmesi için görünmesi gereken oran (0–1). */
  amount?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<
  ComponentPropsWithoutRef<T>,
  "as" | "from" | "delay" | "amount" | "className" | "style" | "children"
>;

export function Reveal<T extends ElementType = "div">({
  as,
  from = "up",
  delay = 0,
  amount = 0.2,
  className,
  style,
  children,
  ...rest
}: RevealProps<T>) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Gözlemci yoksa animasyonu atla ve içeriği kalıcı olarak göster:
    // `pending` bırakılırsa içerik hiç görünmez.
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.reveal = "shown";
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.reveal = "shown";
        observer.disconnect();
      },
      { threshold: amount },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [amount]);

  // `createElement` yerine JSX: ref'i props nesnesinin içinde geçirmek React
  // Compiler'ın `react-hooks/refs` kuralını tetikliyor (render sırasında ref
  // okunuyor sayılıyor).
  const Component = (as ?? "div") as ElementType;

  return (
    <Component
      {...rest}
      ref={ref}
      className={className}
      data-reveal="pending"
      style={{
        ...DIRECTION_VARS[from],
        ...(delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : null),
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
