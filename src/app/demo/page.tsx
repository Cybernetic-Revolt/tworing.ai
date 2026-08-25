import Link from "next/link";
import { listDemoOrgs } from "@/lib/demo";
import { Logo } from "../brand";

export const metadata = { title: "Live demo — TwoRing" };
// The chooser reads live org data — never prerender it at build time.
export const dynamic = "force-dynamic";

const DEMO_DETAILS: Record<
  string,
  { tagline: string; phone: string; tel: string }
> = {
  "james-plumbing": {
    tagline: "Plumbing & heating — call James, then watch your call appear.",
    phone: "1 (620) 282-6163",
    tel: "tel:+16202826163",
  },
  "billys-realty": {
    tagline: "Real estate office — call Sarah, then watch your call appear.",
    phone: "1 (289) 999-1089",
    tel: "tel:+12899991089",
  },
  "joes-lawn-snow": {
    tagline: "Lawn care & snow removal — call Kelly, then watch your call appear.",
    phone: "1 (818) 607-9476",
    tel: "tel:+18186079476",
  },
};

export default async function DemoChooserPage() {
  const orgs = await listDemoOrgs();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
            <Logo />
          </Link>
        </div>
        <h1 className="text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Pick a demo company
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-zinc-500">
          These are real, live portals — the same software our clients use.
          Call the demo line, hang up, and your call shows up inside within
          seconds.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {orgs.map((org) => {
            const d = DEMO_DETAILS[org.slug];
            return (
              <div
                key={org.slug}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {org.name}
                </h2>
                {d && (
                  <p className="mt-1 text-sm text-zinc-500">{d.tagline}</p>
                )}
                {d && (
                  <a href={d.tel} className="mt-3 text-sm font-medium text-emerald-600 hover:underline">
                    Call {d.phone}
                  </a>
                )}
                {/* Plain <a>: a Next Link would prefetch and set the cookie */}
                <a
                  href={`/demo/${org.slug}`}
                  className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Open the portal
                </a>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Back to tworing.ai
          </Link>
        </p>
      </div>
    </div>
  );
}
