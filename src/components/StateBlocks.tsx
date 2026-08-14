/** Shared loading/empty/error blocks so every data page fails gracefully. */

export function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const rateLimited = /429/.test(message ?? "");
  const timedOut = /50\d|timeout|fetch/i.test(message ?? "");
  return (
    <div className="anim-fade glass rounded-2xl p-8 text-center">
      <h2 className="font-display text-lg font-bold text-white">
        {rateLimited ? "Slow down a sec" : "Couldn't load this"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
        {rateLimited
          ? "The anime database is rate-limiting us right now. Give it a moment and try again."
          : timedOut
            ? "The anime database took too long to respond. This usually clears up in a few seconds."
            : (message ?? "Something went wrong while fetching data.")}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="anim-fade glass rounded-2xl p-8 text-center">
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      {hint && <p className="mx-auto mt-2 max-w-md text-sm text-white/60">{hint}</p>}
    </div>
  );
}
