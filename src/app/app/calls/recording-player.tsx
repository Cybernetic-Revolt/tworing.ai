"use client";

import { useState } from "react";

/**
 * The call-detail recording player.
 *
 * Two failure modes shaped this component, both found by walking the product as a customer:
 *
 * - A bare `<audio src>` with no `preload` pulls the media eagerly, and the recording streams
 *   through our S3 proxy — a call-detail page was measured at 15.9s to settle because the
 *   whole file downloaded before anyone pressed play. `preload="none"` makes opening the page
 *   cost nothing; the download starts when the customer asks for it.
 *
 * - Recordings from the Vapi era point at that provider's storage and at expiring R2
 *   presigned URLs. Those links are dead now, and a dead link rendered as a player showing
 *   0:00 that silently does nothing — indistinguishable from "the product is broken". An
 *   error state has to say what actually happened.
 */
export function RecordingPlayer({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        This recording is no longer available — it was stored with a previous provider and the
        link has expired. Newer calls are stored with us and keep playing.
      </p>
    );
  }
  return (
    <audio
      controls
      preload="none"
      src={src}
      aria-label={label}
      onError={() => setFailed(true)}
      className="mt-3 w-full"
    />
  );
}
