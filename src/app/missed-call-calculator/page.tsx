import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "../brand";
import { RoiCalculator } from "../roi-calculator";

const DESC =
  "See how much revenue your business loses to missed calls every month — and how fast a 24/7 AI receptionist pays for itself. Free interactive calculator, no signup.";

export const metadata: Metadata = {
  title: "Missed-Call Revenue Calculator — what unanswered calls cost you",
  description: DESC,
  alternates: { canonical: "/missed-call-calculator" },
  openGraph: {
    title: "What are missed calls costing your business?",
    description: DESC,
    url: "/missed-call-calculator",
    siteName: "TwoRing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "What are missed calls costing your business?",
    description: DESC,
  },
};

const POINTS = [
  {
    stat: "1 in 4",
    label: "calls to small businesses go unanswered — and most callers never call back.",
  },
  {
    stat: "85%",
    label: "of people whose call isn't answered won't try again. They call your competitor.",
  },
  {
    stat: "2 rings",
    label: "is all it takes. TwoRing answers, books the job, and emails you the lead.",
  },
];

export default function MissedCallCalculatorPage() {
  return (
    <div className="bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-80"
          >
            <Logo />
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero + calculator */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(16,185,129,0.10),transparent)]"
          aria-hidden
        />
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center sm:pt-20">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Free calculator · no signup
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            What are missed calls really costing you?
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Most owners underestimate it. Drag the sliders to your numbers and
            you&apos;ll see the revenue walking out the door every month — and
            how fast a 24/7 AI receptionist pays for itself.
          </p>
        </div>
        <div className="mx-auto max-w-4xl px-4 pb-16">
          <RoiCalculator />
        </div>
      </section>

      {/* Why it happens */}
      <section className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Every unanswered call is a customer your competitor just won
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {POINTS.map((p) => (
              <div
                key={p.stat}
                className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {p.stat}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {p.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Stop letting the phone cost you customers.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
          TwoRing answers every call in two rings, books the appointment into
          your calendar during the call, and emails you the lead. Keep your
          number, keep your carrier. First two weeks free.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/#demo"
            className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Hear a live demo →
          </Link>
          <Link
            href="/#pricing"
            className="rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            See plans
          </Link>
        </div>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Month-to-month · cancel anytime · backed by the Found Money Guarantee
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 text-center">
          <Logo />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Because your customers should never hear a third ring. · A product of
            Bilco Works Inc.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            <Link
              href="/"
              className="hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Home
            </Link>
            {" · "}
            <Link
              href="/privacy"
              className="hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Privacy
            </Link>
            {" · "}
            <Link
              href="/terms"
              className="hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Terms
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
