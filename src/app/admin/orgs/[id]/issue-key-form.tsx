"use client";

import { useActionState } from "react";
import { issueIngestKey, type IssueKeyState } from "../../actions";

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function IssueKeyForm({ orgId }: { orgId: string }) {
  const [state, formAction, pending] = useActionState<IssueKeyState, FormData>(
    issueIngestKey,
    null,
  );

  return (
    <div>
      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="orgId" value={orgId} />
        <input
          name="label"
          placeholder="Label (e.g. vapi, n8n)"
          required
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Issuing…" : "Issue key"}
        </button>
      </form>
      {state?.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.rawKey && (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Copy this key now — it is shown only once:
          <code className="mt-1 block break-all font-mono text-xs">
            {state.rawKey}
          </code>
        </div>
      )}
    </div>
  );
}
