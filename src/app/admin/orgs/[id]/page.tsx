import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cleanSummary, formatDuration, formatWhen } from "@/lib/format";
import { addMember, addNumber, setNumberAssistant, updateOrg } from "../../actions";
import { IssueKeyForm } from "./issue-key-form";
import { CheckoutLinkForm } from "./checkout-link-form";

const errors: Record<string, string> = {
  missing: "Required fields are missing.",
  weak: "Password must be at least 10 characters.",
  number: "That number is invalid or already registered.",
};

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const tableClass =
  "w-full text-left text-sm rounded-xl overflow-hidden";
const thClass =
  "px-4 py-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800";
const tdClass = "px-4 py-2 text-zinc-700 dark:text-zinc-300";
const cardClass =
  "overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";

export default async function AdminOrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireEngineer();
  const { id } = await params;
  const { error, saved } = await searchParams;

  const org = await prisma.org.findUnique({
    where: { id },
    include: {
      members: { include: { user: true }, orderBy: { role: "asc" } },
      phoneNumbers: { include: { assistant: true } },
      ingestKeys: { orderBy: { createdAt: "desc" } },
      calls: { orderBy: { startedAt: "desc" }, take: 10 },
      subscription: true,
      _count: {
        select: { calls: true, leads: true, availabilityRules: true },
      },
    },
  });
  if (!org) notFound();

  const assistants = await prisma.assistant.findMany({
    where: { orgId: id },
    orderBy: { name: "asc" },
  });

  // §6 onboarding wizard: compute readiness from the org's own data.
  const ownerWithLogin = org.members.find(
    (m) => m.role === "OWNER" && m.user.passwordHash,
  );
  const steps = [
    {
      label: "Business details",
      done: !!org.notifyEmail,
      hint: "Set the lead-summary email under Settings.",
    },
    {
      label: "Phone number assigned",
      done: org.phoneNumbers.length > 0,
      hint: "Add the client's DID under Phone numbers.",
    },
    {
      label: "Assistant bound",
      done: org.phoneNumbers.some((n) => n.assistantId),
      hint: "Assign an assistant to a phone number below.",
    },
    {
      label: "Ingest key issued",
      done: org.ingestKeys.length > 0,
      hint: "Issue a per-tenant key under Ingest keys.",
    },
    {
      label: "Business hours set",
      done: org._count.availabilityRules > 0,
      hint: "Owner sets hours in Calendar → Hours & booking.",
    },
    {
      label: "Owner login created",
      done: !!ownerWithLogin,
      hint: "Add an OWNER with a temp password under Members.",
    },
    {
      label: "First test call received",
      done: org._count.calls > 0,
      hint: "Place a test call to the assistant.",
    },
    {
      label: "Billing active",
      done:
        org.subscription?.status === "ACTIVE" ||
        org.subscription?.status === "TRIALING",
      hint: "Generate a Stripe checkout link and send it to the client.",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;

  return (
    <div>
      <Link href="/admin" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← Clients
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {org.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {org.slug} · {org._count.calls} calls · {org._count.leads} leads
      </p>

      <section className="mt-6 max-w-lg rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Onboarding
          </h2>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {doneCount}/{total} complete
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
          />
        </div>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-2">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  s.done
                    ? "bg-emerald-500 text-white"
                    : "border border-zinc-300 text-transparent dark:border-zinc-600"
                }`}
              >
                ✓
              </span>
              <span>
                <span
                  className={
                    s.done
                      ? "text-zinc-800 dark:text-zinc-200"
                      : "text-zinc-700 dark:text-zinc-300"
                  }
                >
                  {s.label}
                </span>
                {!s.done && (
                  <span className="block text-xs text-zinc-400 dark:text-zinc-500">{s.hint}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {error && errors[error] && (
        <p className="mt-4 max-w-lg rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errors[error]}
        </p>
      )}
      {saved && (
        <p className="mt-4 max-w-lg rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Saved.
        </p>
      )}

      <Section title="Settings">
        <form action={updateOrg} className="flex max-w-lg flex-col gap-3">
          <input type="hidden" name="id" value={org.id} />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="name"
              defaultValue={org.name}
              required
              className={inputClass}
            />
            <select name="tier" defaultValue={org.tier} className={inputClass}>
              <option value="ANSWER">Answer — $179</option>
              <option value="OFFICE">Office — $349</option>
              <option value="OPERATIONS">Operations — $599</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="notifyEmail"
              type="email"
              defaultValue={org.notifyEmail ?? ""}
              placeholder="Lead-summary email"
              className={inputClass}
            />
            <input
              name="timezone"
              defaultValue={org.timezone}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Save settings
          </button>
        </form>
      </Section>

      <Section title="Members">
        <div className={cardClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Email</th>
                <th className={thClass}>Name</th>
                <th className={thClass}>Role</th>
                <th className={thClass}>Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {org.members.map((m) => (
                <tr key={m.id}>
                  <td className={tdClass}>{m.user.email}</td>
                  <td className={tdClass}>{m.user.name ?? "—"}</td>
                  <td className={tdClass}>{m.role}</td>
                  <td className={tdClass}>
                    {m.user.passwordHash ? "enabled" : "no password set"}
                  </td>
                </tr>
              ))}
              {org.members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400 dark:text-zinc-500">
                    No members.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form action={addMember} className="mt-4 flex max-w-2xl flex-wrap items-center gap-3">
          <input type="hidden" name="orgId" value={org.id} />
          <input name="email" type="email" placeholder="email" required className={inputClass} />
          <input name="name" placeholder="Name" className={inputClass} />
          <input
            name="password"
            type="password"
            placeholder="Temp password (10+)"
            minLength={10}
            className={inputClass}
          />
          <select name="role" defaultValue="MEMBER" className={inputClass}>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Add member
          </button>
        </form>
      </Section>

      <Section title="Phone numbers">
        <div className={cardClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Number</th>
                <th className={thClass}>Label</th>
                <th className={thClass}>Provider</th>
                <th className={thClass}>Assistant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {org.phoneNumbers.map((n) => (
                <tr key={n.id}>
                  <td className={tdClass}>{n.e164}</td>
                  <td className={tdClass}>{n.label ?? "—"}</td>
                  <td className={tdClass}>{n.provider}</td>
                  <td className={tdClass}>
                    <form action={setNumberAssistant} className="flex items-center gap-2">
                      <input type="hidden" name="orgId" value={org.id} />
                      <input type="hidden" name="numberId" value={n.id} />
                      <select
                        name="assistantId"
                        defaultValue={n.assistantId ?? ""}
                        className={`${inputClass} min-w-40`}
                      >
                        <option value="">— none —</option>
                        {assistants.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                        {/* A bound assistant that is somehow not in this org's list must
                            still be visible rather than silently appearing unassigned. */}
                        {n.assistantId &&
                          !assistants.some((a) => a.id === n.assistantId) && (
                            <option value={n.assistantId}>
                              {n.assistant?.name ?? n.assistantId} (unknown)
                            </option>
                          )}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {org.phoneNumbers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400 dark:text-zinc-500">
                    No numbers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form action={addNumber} className="mt-4 flex max-w-2xl flex-wrap items-center gap-3">
          <input type="hidden" name="orgId" value={org.id} />
          <input name="e164" placeholder="(403) 555-0123" required className={inputClass} />
          <input name="label" placeholder="Label" className={inputClass} />
          <select name="provider" defaultValue="voipms" className={inputClass}>
            <option value="voipms">VoIP.ms</option>
            <option value="vapi">Vapi</option>
            <option value="external">External</option>
          </select>
          <select name="assistantId" defaultValue="" className={inputClass}>
            <option value="">— no assistant yet —</option>
            {assistants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Add number
          </button>
        </form>
      </Section>

      <Section title="Billing">
        {org.subscription ? (
          <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">{org.subscription.status}</span> ·{" "}
            {org.subscription.tier}
            {org.subscription.currentPeriodEnd
              ? ` · renews ${formatWhen(org.subscription.currentPeriodEnd, org.timezone)}`
              : org.subscription.trialEndsAt
                ? ` · trial ends ${formatWhen(org.subscription.trialEndsAt, org.timezone)}`
                : ""}
          </p>
        ) : (
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">No subscription yet.</p>
        )}
        <CheckoutLinkForm orgId={org.id} />
      </Section>

      <Section title="Ingest keys">
        <div className={cardClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Label</th>
                <th className={thClass}>Created</th>
                <th className={thClass}>Last used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {org.ingestKeys.map((k) => (
                <tr key={k.id}>
                  <td className={tdClass}>{k.label}</td>
                  <td className={tdClass}>{formatWhen(k.createdAt, org.timezone)}</td>
                  <td className={tdClass}>
                    {k.lastUsedAt ? formatWhen(k.lastUsedAt, org.timezone) : "never"}
                  </td>
                </tr>
              ))}
              {org.ingestKeys.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-400 dark:text-zinc-500">
                    No keys.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <IssueKeyForm orgId={org.id} />
        </div>
      </Section>

      <Section title="Recent calls">
        <div className={cardClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>When</th>
                <th className={thClass}>Caller</th>
                <th className={thClass}>Duration</th>
                <th className={thClass}>Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {org.calls.map((c) => (
                <tr key={c.id}>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatWhen(c.startedAt, org.timezone)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {c.callerName ?? c.callerNumber ?? "Unknown"}
                  </td>
                  <td className={tdClass}>{formatDuration(c.durationSec)}</td>
                  <td className={`${tdClass} max-w-md`}>
                    <span className="line-clamp-2">{cleanSummary(c.summary) ?? "—"}</span>
                  </td>
                </tr>
              ))}
              {org.calls.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400 dark:text-zinc-500">
                    No calls yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
