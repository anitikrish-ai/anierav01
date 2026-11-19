import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-triggered reveal.
 *
 * Optimised for cost: one shared IntersectionObserver for the whole app,
 * each element is unobserved the moment it reveals, and the animation only
 * touches opacity + transform (compositor-only, no layout/paint).
 * Includes an automatic safety reveal fallback so filtered grids never stall.
 */

type Cb = () => void;
let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, Cb>();

function getObserver() {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return null;
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          callbacks.get(e.target)?.();
          callbacks.delete(e.target);
          observer!.unobserve(e.target);
        }
      },
      { rootMargin: "80px 0px -1% 0px", threshold: 0.01 },
    );
  }
  return observer;
}

export type RevealVariant = "rise" | "fade" | "scale" | "slide-left" | "slide-right";

export function Reveal({
  children,
  variant = "rise",
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const motion = document.documentElement.dataset.motion;
    if (
      motion === "off" ||
      motion === "reduced" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 1.15 && rect.bottom > -40) {
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }

    const io = getObserver();
    if (!io) {
      setShown(true);
      return;
    }

    callbacks.set(el, () => setShown(true));
    io.observe(el);

    const safety = setTimeout(() => setShown(true), 900);
    return () => {
      clearTimeout(safety);
      callbacks.delete(el);
      io.unobserve(el);
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      data-shown={shown ? "true" : "false"}
      className={`reveal reveal-${variant} ${className}`}
      style={delay ? ({ transitionDelay: `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
