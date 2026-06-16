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
}

/**
 * HLS.js-backed player. Falls back to native HLS on Safari.
 */
export function HlsPlayer({ src, tracks, poster, autoPlay = true, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setErr(null);

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setErr(`Playback error (${data.type}/${data.details})`);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      setErr("HLS not supported in this browser.");
    }
    return () => { hls?.destroy(); };
  }, [src]);

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
      {err && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-4 text-center text-sm text-white/80">
          {err}
        </div>
      )}
    </div>
  );
}
