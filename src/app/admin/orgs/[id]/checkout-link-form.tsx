"use client";

import { useActionState } from "react";
import { createCheckoutLink, type CheckoutLinkState } from "../../actions";

export function CheckoutLinkForm({ orgId }: { orgId: string }) {
  const [state, formAction, pending] = useActionState<CheckoutLinkState, FormData>(
    createCheckoutLink,
    null,
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="orgId" value={orgId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Creating…" : "Generate checkout link"}
        </button>
      </form>
      {state?.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.url && (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Send this 14-day-trial checkout link to the client:
          <a
            href={state.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all font-mono text-xs underline"
          >
            {state.url}
          </a>
        </div>
      )}
    </div>
  );
}
