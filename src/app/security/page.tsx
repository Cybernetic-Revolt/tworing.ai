import Link from "next/link";
import { Logo } from "../brand";

export const metadata = {
  title: "Security & trust — TwoRing",
  description:
    "Where your data lives, how CASL is handled, and how TwoRing secures your account. A Canadian company, plainly explained.",
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black";

// Every claim on this page is verifiable in the product or the privacy
// policy — if a capability ships or changes, update this page with it.
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "A Canadian company, under Canadian law",
    body: (
      <>
        TwoRing is operated by Bilco Works Inc. in Calgary, Alberta. We handle
        personal information under Canada&apos;s PIPEDA and Alberta&apos;s PIPA
        — not a foreign framework you&apos;d have to go looking for.
      </>
    ),
  },
  {
    title: "Your data lives in Canada",
    body: (
      <>
        Your business records — calls, transcripts, leads, bookings, and
        messages — are stored on servers located in Canada. A small number of
        service providers process data to make the service work (telephony and
        SMS, the AI voice platform, email delivery, and payments); each one is
        named in our{" "}
        <Link
          href="/privacy"
          className={`rounded font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 ${FOCUS}`}
        >
          privacy policy
        </Link>
        .
      </>
    ),
  },
  {
    title: "CASL is built in, not bolted on",
    body: (
      <>
        Texts go only to people who contacted your business first. Every
        automated reply identifies your business and carries opt-out
        instructions, and a STOP (or UNSUBSCRIBE, CANCEL, END, QUIT) reply is
        honoured automatically — the system stops texting that person
        immediately, and START opts them back in.
      </>
    ),
  },
  {
    title: "Account security that actually revokes",
    body: (
      <>
        Access is role-based — owners, admins, and members see and change only
        what their role allows. When a password changes or a teammate is
        removed or demoted, their existing sessions are revoked immediately,
        not at some future expiry. Every record is scoped to your business;
        one customer can never see another&apos;s data.
      </>
    ),
  },
  {
    title: "Platform hardening",
    body: (
      <>
        Everything runs over TLS with HSTS and modern browser security headers.
        Credentials for connected calendars are encrypted at rest. Outbound
        webhooks are signed (HMAC-SHA256) so the tools you connect can verify
        every event really came from us.
      </>
    ),
  },
  {
    title: "Your data is yours",
    body: (
      <>
        Export your calls, leads, and appointments as CSV or JSON from the
        portal any time — no request form, no waiting. You can also ask us to
        correct or delete your information; the privacy policy explains how.
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className={`flex items-center rounded transition-opacity hover:opacity-80 ${FOCUS}`}>
            <Logo />
          </Link>
          <Link
            href="/"
            className={`rounded text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 ${FOCUS}`}
          >
            ← Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          Security &amp; trust
        </p>
        <h1 className="mt-3 font-display text-3xl font-normal leading-tight sm:text-4xl">
          Where your data lives, and how we look after it.
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">
          &ldquo;Canadian data · CASL-compliant&rdquo; is easy to put on a
          badge. Here&apos;s what it actually means in this product — in plain
          language, with nothing on this page we can&apos;t back up.
        </p>

        <div className="mt-10 flex flex-col gap-6">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {s.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-emerald-300 bg-emerald-50/60 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
          <h2 className="text-base font-semibold tracking-tight text-emerald-900 dark:text-emerald-100">
            Found something?
          </h2>
          <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
            If you spot a security issue, email{" "}
            <a
              href="mailto:message@bilco.ca"
              className={`rounded font-medium underline underline-offset-2 hover:text-emerald-950 dark:hover:text-emerald-50 ${FOCUS}`}
            >
              message@bilco.ca
            </a>{" "}
            — it goes straight to the founder and gets looked at fast.
          </p>
        </div>

        <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
          The full details live in the{" "}
          <Link
            href="/privacy"
            className={`rounded font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 ${FOCUS}`}
          >
            privacy policy
          </Link>{" "}
          and{" "}
          <Link
            href="/terms"
            className={`rounded font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 ${FOCUS}`}
          >
            terms of service
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
