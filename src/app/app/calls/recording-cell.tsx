"use client";

import { useState } from "react";

// Renders a lightweight Play button and only mounts an <audio> element on click,
// so a 200-row call log doesn't instantiate 200 media players at once.
export function RecordingCell({ src, label }: { src: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  // Vapi-era recordings live on that provider's storage and on expired R2 presigned URLs.
  // Without this, clicking Play on one produced a 0:00 player that silently did nothing.
  if (failed) {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500" title="Stored with a previous provider; the link has expired.">
        unavailable
      </span>
    );
  }
  if (playing) {
    return (
      <audio
        controls
        autoPlay
        preload="none"
        src={src}
        aria-label={label}
        onError={() => setFailed(true)}
        className="h-8 w-44"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <span aria-hidden="true">▶</span> Play
    </button>
  );
}
