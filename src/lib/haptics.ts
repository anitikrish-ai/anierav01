/**
 * Subtle tactile vibration triggers for mobile touch interactions.
 *
 * Uses the Web Vibration API on touch-capable devices, respects reduced-motion
 * preferences, and no-ops safely on unsupported platforms or during SSR.
 */

export type HapticStyle = "tap" | "submit";

const PATTERNS: Record<HapticStyle, number> = {
  tap: 8,
  submit: 14,
};

export function triggerHaptic(style: HapticStyle = "tap"): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;

  // Skip when motion/sensory feedback is turned off or reduced
  const motion = document.documentElement.dataset.motion;
  if (motion === "off" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  // Only fire on mobile / touch-primary pointers
  const isTouchDevice =
    window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0;
  if (!isTouchDevice) return;

  try {
    navigator.vibrate(PATTERNS[style]);
  } catch {
    /* Ignore browser policy rejections prior to user activation */
  }
}
