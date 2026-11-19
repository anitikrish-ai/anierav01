import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface LiquidTabOption {
  label: string;
  icon?: ReactNode;
}

interface LiquidTabsProps {
  options: (string | LiquidTabOption)[];
  value: number;
  onChange: (index: number) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  wrap?: boolean;
  className?: string;
}

export function LiquidTabs({
  options,
  value,
  onChange,
  ariaLabel,
  size = "sm",
  wrap = false,
  className = "",
}: LiquidTabsProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const normalized: LiquidTabOption[] = options.map((opt) =>
    typeof opt === "string" ? { label: opt } : opt,
  );

  const measure = useCallback(() => {
    const activeBtn = btnRefs.current[value];
    if (!activeBtn) return;
    setPill({
      left: activeBtn.offsetLeft,
      top: activeBtn.offsetTop,
      width: activeBtn.offsetWidth,
      height: activeBtn.offsetHeight,
    });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure, options.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(track);
    for (const btn of btnRefs.current) {
      if (btn) ro.observe(btn);
    }
    return () => ro.disconnect();
  }, [measure, options.length]);

  const padCls = size === "md" ? "px-3.5 py-2 text-xs sm:text-sm" : "px-3 py-1.5 text-xs";

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`liquid-tabs relative inline-flex max-w-full items-center gap-1 rounded-[20px] p-1 ${
        wrap ? "flex-wrap" : "flex-nowrap overflow-x-auto no-scrollbar"
      } ${className}`}
    >
      {pill && (
        <span
          aria-hidden="true"
          className="liquid-tabs-pill pointer-events-none absolute left-0 top-0 rounded-2xl"
          style={{
            width: `${pill.width}px`,
            height: `${pill.height}px`,
            transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
          }}
        />
      )}
      {normalized.map((opt, idx) => {
        const active = idx === value;
        return (
          <button
            key={`${opt.label}-${idx}`}
            ref={(el) => {
              btnRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(idx)}
            className={`relative z-10 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl font-medium transition-colors duration-200 focus-visible:outline-none ${padCls} ${
              active
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.icon && <span className="inline-flex shrink-0 items-center">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
