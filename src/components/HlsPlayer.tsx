import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface Track {
  file: string;
  label?: string;
  kind?: string;
  default?: boolean;
}

interface Props {
  src: string;
  tracks?: Track[];
  poster?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  /** Resume position in seconds. Applied once when metadata is ready. */
  startTime?: number;
  /** Fired ~every 5s with (currentTime, duration). Used to persist progress. */
  onProgress?: (t: number, d: number) => void;
}

interface QualityLevel { index: number; height: number; bitrate: number; }

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

/**
 * HLS.js-backed player with keyboard shortcuts, PiP, speed & quality selectors,
 * and resume-position support. Falls back to native HLS on Safari.
 */
export function HlsPlayer({ src, tracks, poster, autoPlay = true, onEnded, startTime, onProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [qualityIdx, setQualityIdx] = useState<number>(-1); // -1 = auto
  const [pipSupported, setPipSupported] = useState(false);
  const seekedRef = useRef(false);

  // Setup HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setErr(null);
    setQualities([]);
    setQualityIdx(-1);
    seekedRef.current = false;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls!.levels.map((l, i) => ({
          index: i,
          height: l.height ?? 0,
          bitrate: l.bitrate ?? 0,
        }));
        setQualities(levels);
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setErr(`Playback error (${data.type}/${data.details})`);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      setErr("HLS not supported in this browser.");
    }
    setPipSupported(typeof (document as any).pictureInPictureEnabled === "boolean" && (document as any).pictureInPictureEnabled);
    return () => { hls?.destroy(); hlsRef.current = null; };
  }, [src]);

  // Apply startTime once
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !startTime || startTime < 2) return;
    const seek = () => {
      if (seekedRef.current) return;
      try { video.currentTime = startTime; seekedRef.current = true; } catch {}
    };
    video.addEventListener("loadedmetadata", seek, { once: true });
    if (video.readyState >= 1) seek();
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [startTime, src]);

  // Progress ticker
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;
    const int = setInterval(() => {
      if (!video.paused && !video.seeking && video.duration > 0) {
        onProgress(video.currentTime, video.duration);
      }
    }, 5000);
    return () => clearInterval(int);
  }, [onProgress, src]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case "ArrowLeft":
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "ArrowRight":
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          break;
        case "ArrowUp":
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "m":
          video.muted = !video.muted;
          break;
        case "f":
          if (document.fullscreenElement) document.exitFullscreen();
          else video.requestFullscreen?.();
          break;
        case "p":
          togglePip();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const doc = document as any;
      if (doc.pictureInPictureElement) await doc.exitPictureInPicture();
      else await (video as any).requestPictureInPicture?.();
    } catch {}
  };

  const setPlaybackRate = (r: number) => {
    setSpeed(r);
    if (videoRef.current) videoRef.current.playbackRate = r;
  };

  const setQuality = (idx: number) => {
    setQualityIdx(idx);
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
  };

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        controls
        autoPlay={autoPlay}
        poster={poster}
        crossOrigin="anonymous"
        onEnded={onEnded}
        className="h-full w-full"
      >
        {(tracks ?? []).map((t, i) => (
          <track
            key={`${t.file}-${i}`}
            src={t.file}
            kind={(t.kind as any) ?? "captions"}
            label={t.label ?? `Track ${i + 1}`}
            srcLang={t.label?.slice(0, 2).toLowerCase() ?? "en"}
            default={!!t.default}
          />
        ))}
      </video>

      {/* Overlay controls: speed / quality / PiP */}
      <div className="pointer-events-none absolute right-2 top-2 flex gap-1.5">
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={e => setPlaybackRate(Number(e.target.value))}
          className="pointer-events-auto rounded-md bg-black/60 px-2 py-1 text-xs text-white outline-none ring-1 ring-white/20 backdrop-blur hover:bg-black/80"
        >
          {SPEEDS.map(s => <option key={s} value={s} className="bg-background">{s}x</option>)}
        </select>
        {qualities.length > 0 && (
          <select
            aria-label="Quality"
            value={qualityIdx}
            onChange={e => setQuality(Number(e.target.value))}
            className="pointer-events-auto rounded-md bg-black/60 px-2 py-1 text-xs text-white outline-none ring-1 ring-white/20 backdrop-blur hover:bg-black/80"
          >
            <option value={-1} className="bg-background">Auto</option>
            {qualities
              .slice()
              .sort((a, b) => b.height - a.height)
              .map(q => (
                <option key={q.index} value={q.index} className="bg-background">
                  {q.height ? `${q.height}p` : `${Math.round(q.bitrate / 1000)}k`}
                </option>
              ))}
          </select>
        )}
        {pipSupported && (
          <button
            type="button"
            onClick={togglePip}
            aria-label="Picture in picture"
            className="pointer-events-auto rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/80"
          >
            PiP
          </button>
        )}
      </div>

      {err && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-4 text-center text-sm text-white/80">
          {err}
        </div>
      )}
    </div>
  );
}
