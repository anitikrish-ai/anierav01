import { useEffect, useState } from "react";
import { getNextAiring, formatCountdown, type NextAiring } from "@/lib/airing";

/** Live "next episode in …" pill. Renders nothing when the show isn't airing. */
export function AiringCountdown({ malId, className = "" }: { malId: number; className?: string }) {
  const [next, setNext] = useState<NextAiring | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    getNextAiring(malId).then(n => { if (alive) setNext(n); });
    return () => { alive = false; };
  }, [malId]);

  useEffect(() => {
    if (!next) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [next]);

  if (!next) return null;
  const left = next.airingAt - Math.floor(now / 1000);
  const soon = left > 0 && left < 3600;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-medium ${soon ? "text-neon-magenta" : "text-neon-cyan"} ${className}`}
      title={new Date(next.airingAt * 1000).toLocaleString()}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${soon ? "bg-neon-magenta glow-magenta" : "bg-neon-cyan glow-cyan"} animate-pulse`} />
      EP {next.episode} in {formatCountdown(left)}
    </span>
  );
}
