import Link from "next/link";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen, formatDuration } from "@/lib/format";
import { googleConfigured } from "@/lib/google";
import {
  listAssistants,
  listVapiNumbers,
  type VapiAssistant,
  type VapiPhoneNumber,
} from "@/lib/vapi";
import { IssueKeyForm } from "../../admin/orgs/[id]/issue-key-form";
import { revokeIngestKey } from "./actions";

function destBadge(url: string | undefined) {
  if (!url) return { label: "no webhook", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" };
  if (url.includes("/api/ingest/vapi"))
    return { label: "platform", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
  if (url.includes("n8n"))
    return { label: "n8n", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" };
  return { label: "other", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400" };
}

export default async function EngineeringPage() {
  const session = await requireEngineer();

  const [org, numbers, keys, gConn, calls] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: session.orgId } }),
    prisma.phoneNumber.findMany({ where: { orgId: session.orgId } }),
    prisma.ingestKey.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.googleConnection.findUnique({ where: { orgId: session.orgId } }),
    prisma.call.findMany({
      where: { orgId: session.orgId },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        startedAt: true,
        callerNumber: true,
        durationSec: true,
        endedReason: true,
      },
    }),
  ]);

  // Live Vapi account view — best-effort, the page still renders if Vapi is down.
  let assistants: VapiAssistant[] = [];
  let vapiNumbers: VapiPhoneNumber[] = [];
  let vapiError: string | null = null;
  try {
    [assistants, vapiNumbers] = await Promise.all([
      listAssistants(),
      listVapiNumbers(),
    ]);
  } catch (err) {
    vapiError = String(err).slice(0, 200);
  }
  const assistantName = (id: string | undefined | null) =>
    assistants.find((a) => a.id === id)?.name ?? (id ? id.slice(0, 8) : "—");

  const tz = org.timezone;
  const card =
    "rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950";
  const th = "px-3 py-2 font-medium";
  const td = "px-3 py-2";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Engineering — {org.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Telephony and AI internals for this org. Cross-org operations live in{" "}
          <Link href="/admin" className="underline">
            the Engineer console
          </Link>
          .
        </p>
      </div>

      {/* Vapi connection */}
      <div className={card}>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Vapi connection
        </h2>
        {vapiError ? (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            Vapi API unreachable: {vapiError}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Connected — {assistants.length} assistants, {vapiNumbers.length}{" "}
            numbers on the account.
          </p>
        )}
        {!vapiError && (
          <table className="mt-3 w-full text-left text-xs">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className={th}>Vapi number</th>
                <th className={th}>Assistant</th>
                <th className={th}>Webhook destination</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {vapiNumbers.map((n) => {
                const a = assistants.find((x) => x.id === n.assistantId);
                const dest = destBadge(a?.server?.url);
                return (
                  <tr key={n.id} className="text-zinc-700 dark:text-zinc-300">
                    <td className={td}>{n.number ?? n.id.slice(0, 8)}</td>
                    <td className={td}>{assistantName(n.assistantId)}</td>
                    <td className={td}>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${dest.cls}`}>
                        {dest.label}
                      </span>{" "}
                      <span className="break-all text-zinc-400 dark:text-zinc-500">
                        {a?.server?.url ?? ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Org numbers */}
      <div className={card}>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          This org&apos;s numbers
        </h2>
        {numbers.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No numbers recorded.</p>
        ) : (
          <table className="mt-3 w-full text-left text-xs">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className={th}>Number</th>
                <th className={th}>Label</th>
                <th className={th}>Provider</th>
                <th className={th}>SIP subaccount</th>
                <th className={th}>Failover</th>
                <th className={th}>Bound assistant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {numbers.map((n) => (
                <tr key={n.id} className="text-zinc-700 dark:text-zinc-300">
                  <td className={td}>{n.e164}</td>
                  <td className={td}>{n.label ?? "—"}</td>
                  <td className={td}>{n.provider}</td>
                  <td className={td}>{n.sipSubaccount ?? "—"}</td>
                  <td className={td}>
                    {n.failoverE164 ?? (
                      <span className="text-amber-600 dark:text-amber-400">
                        none
                      </span>
                    )}
                  </td>
                  <td className={td}>{assistantName(n.vapiAssistantId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Google connection */}
      <div className={card}>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Google Calendar sync
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {!googleConfigured()
            ? "Server credentials not installed (GOOGLE_CLIENT_ID/SECRET empty)."
            : !gConn
              ? "Configured on the server; this org is not connected yet."
              : `Connected as ${gConn.email} → ${gConn.calendarId ?? "(no calendar chosen)"} · last sync ${
                  gConn.lastSyncAt ? formatWhen(gConn.lastSyncAt, tz) : "never"
                }`}
        </p>
        {gConn?.lastError && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Last error: {gConn.lastError}
          </p>
        )}
      </div>

      {/* Ingest keys */}
      <div className={card}>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Ingest / tool keys
        </h2>
        <table className="mt-3 w-full text-left text-xs">
          <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <tr>
              <th className={th}>Label</th>
              <th className={th}>Created</th>
              <th className={th}>Last used</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {keys.map((k) => (
              <tr key={k.id} className="text-zinc-700 dark:text-zinc-300">
                <td className={td}>{k.label}</td>
                <td className={td}>{formatWhen(k.createdAt, tz)}</td>
                <td className={td}>
                  {k.lastUsedAt ? formatWhen(k.lastUsedAt, tz) : "never"}
                </td>
                <td className={td}>
                  <form action={revokeIngestKey}>
                    <input type="hidden" name="id" value={k.id} />
                    <button type="submit" className="text-red-600 dark:text-red-400 hover:underline">
                      Revoke
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4">
          <IssueKeyForm orgId={org.id} />
        </div>
      </div>

      {/* Recent calls / raw data */}
      <div className={card}>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Recent ingest deliveries
        </h2>
        {calls.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No calls yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-xs">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Caller</th>
                <th className={th}>Duration</th>
                <th className={th}>Ended</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {calls.map((c) => (
                <tr key={c.id} className="text-zinc-700 dark:text-zinc-300">
                  <td className={td}>{formatWhen(c.startedAt, tz)}</td>
                  <td className={td}>{c.callerNumber ?? "—"}</td>
                  <td className={td}>{formatDuration(c.durationSec)}</td>
                  <td className={td}>{c.endedReason ?? "—"}</td>
                  <td className={td}>
                    <Link
                      href={`/app/engineering/calls/${c.id}`}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Raw JSON
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
