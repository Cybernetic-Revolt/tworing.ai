import Link from "next/link";
import { Logo, RingMark } from "./brand";
import { RoiCalculator } from "./roi-calculator";

const DEMO_LINES = [
  {
    label: "A plumbing & heating company",
    display: "1 (620) 282-6163",
    tel: "tel:+16202826163",
  },
  {
    label: "A lawn & snow crew",
    display: "1 (818) 607-9476",
    tel: "tel:+18186079476",
  },
  {
    label: "A real-estate office",
    display: "1 (289) 999-1089",
    tel: "tel:+12899991089",
  },
];
const CONTACT_EMAIL = "message@bilco.ca";

// Shared visible focus ring for keyboard users (a11y) — emerald to match brand.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black";

// Above-the-fold trust signals — honest and verifiable. No invented testimonials.
const TRUST_POINTS: { label: string; href?: string }[] = [
  { label: "Answers in two rings, 24/7" },
  { label: "Books into your real calendar mid-call" },
  { label: "Money-back Found Money Guarantee" },
  { label: "Canadian data · CASL-compliant", href: "/security" },
];

const INDUSTRIES = [
  "HVAC & plumbing",
  "Electrical",
  "Contractors",
  "Lawn & snow",
  "Landscaping",
  "Auto shops",
  "Cleaning & restoration",
  "Clinics & dental",
  "Salons & spas",
  "Real estate",
  "Property management",
  "Pet care",
];

const tiers = [
  {
    name: "Answer",
    price: "$179",
    pitch: "Overflow & after-hours mode: you answer when you can — TwoRing catches the rest.",
    minutes: "400 AI minutes / mo",
    overage: "$0.35/min after",
    popular: false,
    features: [
      "AI receptionist answers 24/7",
      "Books appointments into your calendar mid-call",
      "Email lead summary for every call",
      "Booking confirmations with calendar invite",
      "Monthly Found Money Report",
      "Keep your number — just forward your line",
    ],
  },
  {
    name: "Office",
    price: "$349",
    pitch: "See every call, booking, and lead in one place.",
    minutes: "800 AI minutes / mo",
    overage: "$0.35/min after",
    popular: true,
    features: [
      "Everything in Answer",
      "Web portal: live calendar, recordings & transcripts",
      "Google Calendar two-way sync",
      "Two-way SMS from the dashboard",
      "Missed-call text-back",
    ],
  },
  {
    name: "Operations",
    price: "$599",
    pitch: "Run your front office from one screen.",
    minutes: "1,200 AI minutes / mo",
    overage: "$0.35/min after",
    popular: false,
    features: [
      "Everything in Office, unlimited users",
      "Built-in lead pipeline (light CRM)",
      "Jobber sync (beta) + booking-tool integrations",
      "Review-request engine",
      "Full Found Money dashboard",
    ],
  },
  {
    name: "Custom",
    price: "$1,000+",
    pitch: "Multi-location, managed phone, your rules.",
    minutes: "Custom minutes",
    overage: "Custom rates",
    popular: false,
    features: [
      "Everything in Operations",
      "Multi-location support",
      "Number porting / fully managed phone",
      "Custom integrations & call flows",
      "Dedicated onboarding",
    ],
  },
];

const steps = [
  {
    n: "1",
    title: "Forward your line — you stay in control",
    body: "Keep your number and your phone company. Answer when you can; TwoRing catches everything you can't — busy, after hours, or hands full. Turning it off is one setting.",
    icon: ForwardIcon,
  },
  {
    n: "2",
    title: "Your AI receptionist answers",
    body: "Every call answered in two rings, 24/7. It greets callers by your business name, answers questions, takes the details, and books the appointment into your calendar.",
    icon: WaveIcon,
  },
  {
    n: "3",
    title: "The lead lands in your inbox",
    body: "Seconds after the call ends you get the caller's name, number, reason, and urgency — by email, and in your portal on Office plans and up.",
    icon: InboxIcon,
  },
];

const faqs = [
  {
    q: "Do I need new equipment or a new phone number?",
    a: "No. You keep your number and your carrier. Setup is a call-forwarding setting on your existing line — and turning it off is just as easy.",
  },
  {
    q: "Will callers know they're talking to an AI?",
    a: "Yes. The receptionist identifies itself as an AI assistant at the start of every call, and call recording is disclosed — privacy-first and consent-aware.",
  },
  {
    q: "What kind of business is this for?",
    a: "TwoRing is built for home-service trades — HVAC, plumbing, electrical, contractors, lawn & snow. It works for any business that books appointments or loses callers to voicemail, but the trades are who we obsess over.",
  },
  {
    q: "Do you work with Jobber?",
    a: "Yes — TwoRing can push every AI-booked lead straight into Jobber. It's in early access (beta) on Operations plans; ask us to switch it on for your account.",
  },
  {
    q: "What happens when I use up my included minutes?",
    a: "Nothing stops. Calls keep being answered and you pay a simple per-minute overage rate that gets cheaper on higher tiers. We'll tell you when you're trending over so you can right-size your plan.",
  },
  {
    q: "Is there a contract?",
    a: "Month-to-month, cancel anytime. Your first two weeks are free, and the Found Money Guarantee backs your first 60 days: if TwoRing doesn't book you more than its price in new work, we refund you. If you leave, your number forwards back to you instantly — and if we provisioned it, we port it out, no fees, no games.",
  },
  {
    q: "What happens if the AI ever goes down?",
    a: "Your phone still rings. Every TwoRing number carries carrier-level failover — if our system is ever unreachable, calls fall straight through to your cell, then voicemail. No dead air, ever.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Calls, transcripts, and leads are encrypted at rest, never sold, and never used to train anyone else's models.",
  },
];

/* ----------------------------- icons ----------------------------- */
/* Brand marks (RingMark / Logo) live in ./brand — the single source of truth. */

function ForwardIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12h13M11 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function WaveIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12h2M9 7v10M14 4v16M19 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function InboxIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 13h4l2 3h4l2-3h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ShieldCheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* The hero product graphic: a theme-aware mock of a call being answered and
   booked, so visitors instantly get what TwoRing does. */
function HeroCard() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-emerald-200/40 via-transparent to-emerald-100/30 blur-2xl dark:from-emerald-900/30 dark:to-emerald-800/10"
        aria-hidden
      />
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-emerald-900/10 ring-1 ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/10">
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-900">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
            <RingMark className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 motion-safe:animate-pulse rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-medium">Incoming call</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Answered in two rings</p>
          </div>
          <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Live
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 text-sm">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-zinc-100 px-3 py-2 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            Thanks for calling — how can I help?
          </div>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-600 px-3 py-2 text-white">
            Hi, I need to book someone for Tuesday.
          </div>
          <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-zinc-100 px-3 py-2 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            You're all set for Tuesday at 2:00 PM. I'll text a confirmation.
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckIcon />
          <div className="text-sm">
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              Booked · Tuesday 2:00 PM
            </p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
              Added to your calendar · lead emailed to you
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo animate className="logo-ring flex items-center gap-2" />
          <nav className="hidden gap-6 text-sm text-zinc-600 sm:flex dark:text-zinc-400">
            <a href="#how" className="rounded hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-100">How it works</a>
            <a href="#calculator" className="rounded hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-100">Calculator</a>
            <a href="#pricing" className="rounded hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-100">Pricing</a>
            <a href="#faq" className="rounded hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-100">FAQ</a>
            <a href="/demo" className="rounded hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-100">Live demo</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className={`hidden rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:block dark:text-zinc-400 dark:hover:text-zinc-100 ${FOCUS_RING}`}
            >
              Sign in
            </Link>
            <Link
              href="/start"
              className={`rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 ${FOCUS_RING}`}
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(16,185,129,0.10),transparent)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgba(16,185,129,0.18)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_45%_at_50%_0%,black,transparent)]"
          aria-hidden
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-16 lg:grid-cols-2 lg:pt-24">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden />
              The 24/7 receptionist for the trades
            </span>
            <h1 className="mx-auto mt-5 max-w-2xl font-display text-[2.6rem] font-normal leading-[1.08] sm:text-6xl lg:mx-0">
              Every missed call is a customer your competitor just won.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-zinc-600 lg:mx-0 dark:text-zinc-400">
              You're on a job, up a ladder, or driving to the next call — you
              can't pick up every time, and the caller just dials the next
              result on Google. TwoRing answers in two rings, books the
              appointment right into your calendar during the call, and shows
              you exactly what it earned you every month, in dollars.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start">
              <Link
                href="/start"
                className={`rounded-md bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 ${FOCUS_RING}`}
              >
                Start 2 weeks free →
              </Link>
              <a
                href="#demo"
                className={`rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 ${FOCUS_RING}`}
              >
                Hear a live demo
              </a>
            </div>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 text-sm text-zinc-500 lg:justify-start dark:text-zinc-400">
              <ShieldCheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              First two weeks free · money-back guarantee · cancel anytime
            </p>
          </div>
          <div className="lg:pl-8">
            <HeroCard />
          </div>
        </div>

        {/* Trust band — honest, verifiable proof points */}
        <div className="mx-auto max-w-6xl px-4 pb-12">
          <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-950/80">
            {TRUST_POINTS.map((point) => {
              const inner = (
                <>
                  <ShieldCheckIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {point.label}
                  </span>
                </>
              );
              return point.href ? (
                <Link
                  key={point.label}
                  href={point.href}
                  className={`flex items-center gap-2.5 rounded px-2 hover:opacity-80 ${FOCUS_RING}`}
                >
                  {inner}
                </Link>
              ) : (
                <div key={point.label} className="flex items-center gap-2.5 px-2">
                  {inner}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Don&apos;t take our word for it —{" "}
            <a
              href="#demo"
              className={`rounded font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 ${FOCUS_RING}`}
            >
              call a real TwoRing receptionist right now →
            </a>
          </p>
        </div>

        {/* Industries strip */}
        <div className="border-y border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <p className="text-center text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Built for the trades — and any business that answers the phone
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {INDUSTRIES.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center font-display text-3xl font-normal sm:text-4xl">
          Up and running in one phone setting
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-900/5 transition-shadow hover:shadow-md hover:shadow-emerald-900/5 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Step {s.n}
                  </span>
                </div>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {s.body}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-12 max-w-2xl text-center text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Every month you get the <strong>Found Money Report</strong>: calls
          answered that would have gone to voicemail, appointments booked, and
          what that work was worth against the cost of your plan. Backed by the{" "}
          <strong>Found Money Guarantee</strong> — if TwoRing doesn't book you
          more than its price in your first 60 days, we refund you.
        </p>
      </section>

      {/* Comparison */}
      <section className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center font-display text-3xl font-normal sm:text-4xl">
            What happens to the call you can't take?
          </h2>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
            {[
              {
                name: "Voicemail",
                fate: "Most callers won't leave one. They call the next result on Google.",
                wins: false,
              },
              {
                name: "Answering service ($300+/mo)",
                fate: "A stranger reads a script and takes a message. Nothing gets booked.",
                wins: false,
              },
              {
                name: "Generic AI receptionist",
                fate: "Answers fine, books nothing real, and there's nobody to call when it matters.",
                wins: false,
              },
              {
                name: "TwoRing",
                fate: "Answered in two rings, booked into your real calendar mid-call, and proven in dollars every month. And you reach the founder directly — not a US call-center.",
                wins: true,
              },
            ].map((o) => (
              <div
                key={o.name}
                className={`rounded-xl border p-5 ${
                  o.wins
                    ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-950/30"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                }`}
              >
                <h3 className={`flex items-center gap-2 font-semibold ${o.wins ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                  {o.wins && <ShieldCheckIcon className="h-5 w-5 shrink-0" />}
                  {o.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {o.fate}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI calculator */}
      <section id="calculator" className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-center font-display text-3xl font-normal sm:text-4xl">
          What are missed calls costing you?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-zinc-600 dark:text-zinc-400">
          Drag the sliders to your numbers. Most owners are surprised.
        </p>
        <div className="mt-10">
          <RoiCalculator />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center font-display text-3xl font-normal sm:text-4xl">Plans</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-600 dark:text-zinc-400">
            Per month, in Canadian dollars — no FX, no surprise USD conversion.
            Month-to-month, no setup fee, cancel anytime.
          </p>

          {/* Value anchor — read the prices through the guarantee + live booking */}
          <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong className="font-semibold text-emerald-800 dark:text-emerald-200">
                  60-day Found Money Guarantee.
                </strong>{" "}
                If the appointments TwoRing books you in your first 60 days
                aren&apos;t worth more than you paid, we refund you in full.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong className="font-semibold text-emerald-800 dark:text-emerald-200">
                  Books live, mid-call.
                </strong>{" "}
                Real appointments into your actual calendar during the call — not
                just a text-back link.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 dark:bg-zinc-950 ${
                  t.popular
                    ? "border-emerald-500 shadow-md dark:border-emerald-400"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {t.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-medium text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold">{t.name}</h3>
                <p className="mt-1 min-h-10 text-sm text-zinc-600 dark:text-zinc-400">{t.pitch}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">{t.price}</span>
                  {t.name !== "Custom" && <span className="text-sm text-zinc-500 dark:text-zinc-400">/mo</span>}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t.minutes} · {t.overage}</p>
                <ul className="mt-6 flex flex-col gap-2.5 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2 text-zinc-700 dark:text-zinc-300">
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={t.name === "Custom" ? `mailto:${CONTACT_EMAIL}` : "/start"}
                  className={`mt-auto rounded pt-6 text-center text-sm font-medium ${FOCUS_RING} ${
                    t.popular
                      ? "text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                      : "text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  }`}
                >
                  {t.name === "Custom" ? "Talk to us →" : "Start free →"}
                </a>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Add-ons: extra phone number $25/mo · bilingual receptionist available
            on Custom plans.
          </p>
        </div>
      </section>

      {/* Demo — your strongest, fully honest proof: receptionists a prospect can call live */}
      <section id="demo" className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          Proof you can call
        </p>
        <h2 className="mt-3 font-display text-3xl font-normal sm:text-4xl">Don&apos;t take our word for it</h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
          These are real TwoRing receptionists answering live right now — each
          runs a different kind of business. Call one, ask anything, try to book.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {DEMO_LINES.map((line) => (
            <a
              key={line.tel}
              href={line.tel}
              className={`rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${FOCUS_RING}`}
            >
              <span className="block text-xs font-normal opacity-70">{line.label}</span>
              Call {line.display}
            </a>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <a
            href="/demo"
            className={`rounded font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 ${FOCUS_RING}`}
          >
            Or explore the client portal with sample data →
          </a>
        </p>
      </section>

      {/*
        TESTIMONIALS — drop real customer quotes here once you have them, placed
        immediately before the final CTA (social proof → CTA converts best).
        Each card: { quote, name, business, town }. Do NOT ship invented quotes.
      */}

      {/* FAQ */}
      <section id="faq" className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-center font-display text-3xl font-normal sm:text-4xl">
            Questions owners ask
          </h2>
          <dl className="mt-12 flex flex-col gap-8">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Founder — the verifiable version of "not a US call-center" */}
      <section id="founder" className="mx-auto max-w-3xl px-4 py-20">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 sm:p-10 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Who you&apos;re actually buying from
          </p>
          <h2 className="mt-3 font-display text-3xl font-normal">
            One founder, in Alberta. That&apos;s the point.
          </h2>
          <p className="mt-4 leading-7 text-zinc-600 dark:text-zinc-400">
            TwoRing is built and run by its founder at Bilco Works Inc., a
            Canadian company. There&apos;s no offshore support queue and no
            ticket bot — when you email, it lands in the founder&apos;s inbox,
            and the same person who built the system is the one who sets up
            your receptionist and answers when something needs a human.
          </p>
          <p className="mt-4 leading-7 text-zinc-600 dark:text-zinc-400">
            That cuts both ways: you get straight answers and fast fixes, and
            we only take on the customers we can look after properly.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="mailto:message@bilco.ca"
              className={`inline-flex items-center justify-center rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 ${FOCUS_RING}`}
            >
              Email the founder — message@bilco.ca
            </a>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Real inbox, read by a real person. Usually same-day.
            </span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 text-center">
        <h2 className="font-display text-3xl font-normal sm:text-4xl">
          Stop letting the phone cost you customers.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
          Start free for two weeks. Keep your number, keep your carrier, and let
          TwoRing catch every call you can't.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/start"
            className={`rounded-md bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 ${FOCUS_RING}`}
          >
            Start 2 weeks free →
          </Link>
          <a
            href="#demo"
            className={`rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 ${FOCUS_RING}`}
          >
            Hear a live demo →
          </a>
        </div>
        <p className="mx-auto mt-5 flex max-w-xl items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <ShieldCheckIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Backed by the Found Money Guarantee — more bookings than it costs in your
          first 60 days, or your money back.
        </p>
      </section>

      <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
          <Logo />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Because your customers should never hear a third ring. · A product of
            Bilco Works Inc. · Canadian-owned, built in Alberta.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/security" className="rounded hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-200">Security</Link>
            {" · "}
            <Link href="/privacy" className="rounded hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-200">Privacy</Link>
            {" · "}
            <Link href="/terms" className="rounded hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-200">Terms</Link>
            {" · "}
            <Link href="/login" className="rounded hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:text-zinc-200">Customer sign in</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
