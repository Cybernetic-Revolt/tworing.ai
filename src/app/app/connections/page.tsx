import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { googleConfigured } from "@/lib/google";
import { SettingsTabs } from "../settings-tabs";
import { deleteWebhook, saveWebhook } from "./actions";

export const metadata = { title: "Connections — TwoRing" };

const input =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function Row({
  name,
  blurb,
  status,
  children,
}: {
  name: string;
  blurb: string;
  status: { label: string; ok: boolean };
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {name}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{blurb}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status.ok
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {status.label}
        </span>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireSession();
  const { saved, error } = await searchParams;
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  const [org, google, jobber, webhook] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: session.orgId } }),
    prisma.googleConnection.findMany({
      where: { orgId: session.orgId },
      include: { calendars: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.jobberConnection
      .findUnique({ where: { orgId: session.orgId } })
      .catch(() => null),
    prisma.orgWebhook.findUnique({ where: { orgId: session.orgId } }),
  ]);
  const tz = org.timezone;

  return (
    <div className="max-w-2xl">
      <SettingsTabs />
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Connections
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Send every call, lead, and booking into the tools you already use.
      </p>
      {saved && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Saved.
        </p>
      )}
      {error === "url" && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Enter a valid https:// URL.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <Row
          name="Google Calendar"
          blurb="Two-way sync — bookings appear in your calendar, and the AI never double-books over it."
          status={
            google.length === 0
              ? { label: "Not connected", ok: false }
              : google.every((c) => c.calendars.length > 0)
                ? {
                    label:
                      google.length > 1 ? `${google.length} accounts connected` : "Connected",
                    ok: true,
                  }
                : // At least one account has no calendar chosen — connected but not fully
                  // syncing, which the green "connected" state would hide.
                  { label: "Finish setup — pick a calendar", ok: false }
          }
        >
          {canEdit && google.length === 0 && googleConfigured() && (
            <a
              href="/api/google/oauth/start"
              className="inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Connect Google Calendar
            </a>
          )}
          {google.map((c) => (
            <p key={c.id} className="text-xs text-zinc-500 dark:text-zinc-400">
              {c.email}
              {c.calendars.length === 0
                ? " — pick a calendar in Hours & booking"
                : ` — ${c.calendars.length} calendar${c.calendars.length > 1 ? "s" : ""}`}
            </p>
          ))}
          {google.length > 0 && canEdit && (
            <Link href="/app/calendar/settings" className="text-xs text-emerald-700 hover:underline dark:text-emerald-400">
              Manage calendars &amp; add another account →
            </Link>
          )}
        </Row>

        <Row
          name="Jobber"
          blurb="New leads sync into Jobber as clients, and booked appointments arrive as requests. (Operations tier)"
          status={
            jobber
              ? { label: "Connected", ok: true }
              : { label: "Not connected", ok: false }
          }
        >
          {jobber ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Connected{jobber.accountId ? ` · account ${jobber.accountId}` : ""}
              {jobber.lastError ? ` · last error: ${jobber.lastError}` : ""}
            </p>
          ) : (
            canEdit && (
              <a
                href="/api/jobber/oauth/start"
                className="inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Connect Jobber
              </a>
            )
          )}
        </Row>

        <Row
          name="Outbound webhook"
          blurb="Send a signed event to Zapier, Make, or n8n on every new lead and booking — the bridge to Yardbook and anything else."
          status={
            webhook?.enabled
              ? { label: "Active", ok: true }
              : { label: "Off", ok: false }
          }
        >
          {webhook && (
            <p className="mb-3 break-all text-xs text-zinc-500 dark:text-zinc-400">
              {webhook.url}
              {webhook.lastFiredAt && (
                <span className="block text-zinc-400 dark:text-zinc-500">
                  last fired {formatWhen(webhook.lastFiredAt, tz)} ·{" "}
                  {webhook.lastError ?? `HTTP ${webhook.lastStatus ?? "?"}`}
                </span>
              )}
            </p>
          )}
          {canEdit ? (
            <>
              <form action={saveWebhook} className="flex flex-wrap items-center gap-2">
                <input
                  name="url"
                  defaultValue={webhook?.url ?? ""}
                  placeholder="https://hooks.zapier.com/..."
                  className={`${input} flex-1`}
                />
                <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={webhook?.enabled ?? true}
                    className="h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
                  />
                  On
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Save
                </button>
              </form>
              {webhook && (
                <form action={deleteWebhook} className="mt-2">
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Remove webhook
                  </button>
                </form>
              )}
            </>
          ) : (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Sends a signed JSON payload (HMAC-SHA256, header
              x-tworing-signature) on lead.created and appointment.created.
            </p>
          )}
        </Row>
      </div>
    </div>
  );
}
