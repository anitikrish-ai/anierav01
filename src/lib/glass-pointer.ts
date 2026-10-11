/**
 * Moves the specular highlight of every `.liquid-glass` surface toward the
 * pointer. One delegated listener, one rAF per frame, writes two CSS vars on a
 * single element. Disabled on touch devices and for reduced-motion users.
 */
export function initGlassPointer(): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)");
  if (!mq.matches) return () => {};

  let raf = 0;
  let target: HTMLElement | null = null;
  let x = 0;
  let y = 0;

  const onMove = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.(".liquid-glass") as HTMLElement | null;
    if (!el) return;
    target = el;
    x = e.clientX;
    y = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!target) return;
      const r = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${x - r.left}px`);
      target.style.setProperty("--my", `${y - r.top}px`);
    });
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    document.removeEventListener("pointermove", onMove);
    if (raf) cancelAnimationFrame(raf);
  };
}
