import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsTabs } from "../settings-tabs";
import { updateSettings } from "./actions";

export const metadata = { title: "Business settings — TwoRing" };

const ERRORS: Record<string, string> = {
  name: "Business name can't be empty.",
  email: "Enter a valid notification email.",
  url: "The review link must start with https://",
};

const TIMEZONES = [
  "America/Edmonton",
  "America/Vancouver",
  "America/Regina",
  "America/Winnipeg",
  "America/Toronto",
  "America/Halifax",
  "America/St_Johns",
];

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
const hint = "text-xs font-normal text-zinc-500 dark:text-zinc-400";

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireSession();
  const { error, saved } = await searchParams;
  const org = await prisma.org.findUniqueOrThrow({ where: { id: session.orgId } });
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";
  const tzOptions = TIMEZONES.includes(org.timezone) ? TIMEZONES : [org.timezone, ...TIMEZONES];

  return (
    <div className="max-w-2xl">
      <SettingsTabs />
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Business settings
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        How your AI receptionist represents {org.name} and where your leads go.
      </p>

      {error && ERRORS[error] && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {ERRORS[error]}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Settings saved.
        </p>
      )}
      {!canEdit && (
        <p className="mt-4 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          You can view these settings. Ask an owner or admin to make changes.
        </p>
      )}

      <form action={updateSettings} className="mt-5 flex flex-col gap-5">
        <fieldset disabled={!canEdit} className="flex flex-col gap-5 disabled:opacity-70">
          <Section title="Business" desc="Your name and timezone — used in greetings and scheduling.">
            <label className={labelClass}>
              Business name
              <input name="name" defaultValue={org.name} required className={inputClass} />
            </label>
            <label className={labelClass}>
              Timezone
              <select name="timezone" defaultValue={org.timezone} className={inputClass}>
                {tzOptions.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </label>
          </Section>

          <Section title="Leads & notifications" desc="Where lead summaries and reply notifications are sent.">
            <label className={labelClass}>
              Notification email
              <input name="notifyEmail" type="email" defaultValue={org.notifyEmail ?? ""} placeholder="you@yourbusiness.com" className={inputClass} />
              <span className={hint}>Every call summary and SMS-reply alert goes here.</span>
            </label>
          </Section>

          <Section title="Call handling" desc="Where a caller who asks for a person is warm-transferred.">
            <label className={labelClass}>
              Human transfer number
              <input name="transferNumber" type="tel" defaultValue={org.transferNumber ?? ""} placeholder="(587) 555-0100" className={inputClass} />
              <span className={hint}>Must be a real person&apos;s line — not one that forwards back into the AI.</span>
            </label>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Business hours live under{" "}
              <Link href="/app/calendar/settings" className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
                Calendar → hours
              </Link>.
            </p>
          </Section>

          <Section title="Found Money & reviews" desc="Powers your monthly report and the review-request engine.">
            <label className={labelClass}>
              Average job value (CAD)
              <input name="averageJobValue" type="text" inputMode="numeric" defaultValue={org.averageJobValue ?? ""} placeholder="450" className={inputClass} />
              <span className={hint}>What a booked job is typically worth — used to total your recovered revenue.</span>
            </label>
            <label className={labelClass}>
              Google review link
              <input name="googleReviewUrl" type="url" defaultValue={org.googleReviewUrl ?? ""} placeholder="https://g.page/r/..." className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" name="reviewRequests" defaultChecked={org.reviewRequests} className="h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700" />
              Text a review request after a completed appointment
            </label>
          </Section>

          {canEdit && (
            <button
              type="submit"
              className="self-start rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Save settings
            </button>
          )}
        </fieldset>
      </form>
    </div>
  );
}
