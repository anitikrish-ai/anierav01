import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { jikan, bestTitle } from "@/lib/jikan";
import { useEffect, useMemo, useState } from "react";
import { saveHistory } from "@/lib/history";

type Server = "vidnest" | "megaplay" | "2anime";
type Lang = "sub" | "dub";

export const Route = createFileRoute("/watch/$id/$ep")({
  component: WatchPage,
});

function buildEmbed(server: Server, malId: number, ep: number, lang: Lang): string {
  switch (server) {
    case "vidnest":
      return `https://vidnest.fun/anime/${malId}/${ep}/${lang}`;
    case "megaplay":
      return `https://megaplay.buzz/stream/s-2/${malId}-${ep}/${lang}`;
    case "2anime":
      return `https://2anime.xyz/embed/${malId}-episode-${ep}`;
  }
}

function WatchPage() {
  const { id, ep } = Route.useParams();
  const navigate = useNavigate();
  const malId = Number(id);
  const epNum = Number(ep);
  const [server, setServer] = useState<Server>("vidnest");
  const [lang, setLang] = useState<Lang>("sub");

  const animeQ = useQuery({ queryKey: ["anime", malId], queryFn: () => jikan.anime(malId) });
  const a = animeQ.data?.data;
  const total = a?.episodes ?? null;

  const embed = useMemo(() => buildEmbed(server, malId, epNum, lang), [server, malId, epNum, lang]);

  useEffect(() => {
    if (!a) return;
    saveHistory({
      malId,
      title: bestTitle(a),
      image: a.images.webp?.large_image_url || a.images.jpg.large_image_url,
      episode: epNum,
      totalEpisodes: total,
      lang,
      updatedAt: Date.now(),
    });
  }, [a, malId, epNum, lang, total]);

  const goEp = (next: number) => {
    if (next < 1) return;
    if (total && next > total) return;
    navigate({ to: "/watch/$id/$ep", params: { id, ep: String(next) } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
        <Link to="/" className="hover:text-white">Home</Link>
        <span>/</span>
        {a ? (
          <Link to="/anime/$id" params={{ id }} className="hover:text-white">{bestTitle(a)}</Link>
        ) : <span>Loading…</span>}
        <span>/</span>
        <span className="text-white">Episode {epNum}</span>
      </div>

      <div className="overflow-hidden rounded-3xl glass-strong">
        <div className="aspect-video w-full bg-black">
          <iframe
            key={embed}
            src={embed}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="h-full w-full"
          />
        </div>
        <div className="grid gap-3 p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-bold text-white">
              {a ? bestTitle(a) : "Loading…"} <span className="text-neon-cyan">· EP {epNum}</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle value={lang} options={[["sub", "SUB"], ["dub", "DUB"]]} onChange={v => setLang(v as Lang)} />
            <select
              value={server}
              onChange={e => setServer(e.target.value as Server)}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
            >
              <option value="vidnest" className="bg-background">Server: VidNest</option>
              <option value="megaplay" className="bg-background">Server: MegaPlay</option>
              <option value="2anime" className="bg-background">Server: 2anime</option>
            </select>
            <button onClick={() => goEp(epNum - 1)} disabled={epNum <= 1}
              className="rounded-lg glass px-3 py-2 text-xs font-medium text-white disabled:opacity-40">
              ← Prev
            </button>
            <button onClick={() => goEp(epNum + 1)} disabled={!!total && epNum >= total}
              className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-3 py-2 text-xs font-semibold text-background disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>
      </div>

      {a && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-white">Episodes</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {Array.from({ length: total ?? 12 }).map((_, i) => {
              const n = i + 1;
              const active = n === epNum;
              return (
                <Link key={n} to="/watch/$id/$ep" params={{ id, ep: String(n) }}
                  className={`rounded-lg px-2 py-2 text-center text-xs font-semibold transition ${
                    active ? "bg-gradient-to-r from-neon-cyan to-neon-magenta text-background" : "glass text-white/80 hover:text-white"
                  }`}>
                  {n}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Toggle({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="glass flex rounded-lg p-0.5">
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === val ? "bg-white/15 text-neon-cyan" : "text-white/70 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}