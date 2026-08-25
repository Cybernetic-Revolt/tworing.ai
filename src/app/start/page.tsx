import Link from "next/link";
import { Logo } from "../brand";
import { submitSignup } from "./actions";

export const metadata = {
  title: "Start free — TwoRing",
  description:
    "Start your two free weeks with TwoRing, the 24/7 AI receptionist for the trades. No card required.",
};

const TRADES = [
  "HVAC & heating",
  "Plumbing",
  "Electrical",
  "Contractor / renovation",
  "Lawn & snow",
  "Landscaping",
  "Roofing",
  "Auto shop",
  "Cleaning & restoration",
  "Other trade",
  "Other business",
];

const PERKS = [
  "Two weeks free — no credit card",
  "Keep your number and your carrier",
  "We call you to set it up (about 15 minutes)",
  "Cancel anytime · 60-day Found Money Guarantee",
];

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black";
const field =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 " +
  FOCUS;

function ShieldCheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className={`flex items-center rounded transition-opacity hover:opacity-80 ${FOCUS}`}>
            <Logo />
          </Link>
          <Link
            href="/login"
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 ${FOCUS}`}
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-2 lg:py-20">
        {/* Left — the recap */}
        <div className="lg:pt-6">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Start free
          </p>
          <h1 className="mt-3 font-display text-3xl font-normal leading-tight sm:text-4xl">
            Stop losing jobs to voicemail.
          </h1>
          <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">
            Tell us about your business and we&apos;ll get your AI receptionist
            answering — usually the same day. It&apos;s a quick setup call, then
            it starts catching the calls you can&apos;t.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
            Rather try it first?{" "}
            <Link href="/#demo" className={`rounded font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 ${FOCUS}`}>
              Call a live demo receptionist →
            </Link>
          </p>
        </div>

        {/* Right — the form / confirmation */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-950/60">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <ShieldCheckIcon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-normal">You&apos;re on the list.</h2>
              <p className="mt-3 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
                We got your details and someone will reach out shortly to set up
                your two free weeks — no card, nothing to install. Talk soon.
              </p>
              <Link
                href="/"
                className={`mt-6 rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 ${FOCUS}`}
              >
                Back to home
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Start your two free weeks</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                No credit card. We&apos;ll call to get you live.
              </p>
              {error && (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  Please add your business, name, a valid email, and a phone number.
                </p>
              )}
              <form action={submitSignup} className="mt-5 flex flex-col gap-3.5">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Business name
                  <input name="business" required maxLength={200} placeholder="e.g. Joe's Plumbing & Heating" className={field} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Your name
                  <input name="name" required maxLength={200} autoComplete="name" className={field} />
                </label>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Email
                    <input name="email" type="email" required autoComplete="email" className={field} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Phone
                    <input name="phone" type="tel" required autoComplete="tel" placeholder="(587) 555-0100" className={field} />
                  </label>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Trade
                    <select name="trade" defaultValue="" className={field}>
                      <option value="" disabled>Select…</option>
                      {TRADES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    City
                    <input name="city" maxLength={80} placeholder="Calgary, AB" className={field} />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Anything we should know? <span className="font-normal text-zinc-400">(optional)</span>
                  <textarea name="notes" rows={2} maxLength={1000} className={`${field} resize-none`} />
                </label>
                <button
                  type="submit"
                  className={`mt-1 rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 ${FOCUS}`}
                >
                  Start my two free weeks →
                </button>
                <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
                  By submitting you agree to be contacted about setup. No spam, ever.
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
