import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManagePush, pushPublicKey } from "@/lib/push";
import { SettingsTabs } from "../../settings-tabs";
import { saveNotificationPrefs } from "./actions";
import { PushControls } from "./push-controls";

export const metadata = { title: "Notifications — TwoRing" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireSession();
  const { saved } = await searchParams;
  const [pref, devices] = await Promise.all([
    prisma.notificationPref.findUnique({ where: { userId: session.userId } }),
    prisma.pushSubscription.count({ where: { userId: session.userId } }),
  ]);
  const publicKey = pushPublicKey();
  const demo = !canManagePush(session);

  if (demo) {
    return (
      <div className="max-w-2xl">
        <SettingsTabs />
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Notifications
        </h1>
        <p
          data-push-state="demo"
          className="mt-3 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
        >
          In the demo, notifications are switched off — this login is shared. On your own
          account, this page turns on push notifications per device and lets you choose which
          events reach your phone.
        </p>
      </div>
    );
  }

  const toggles = [
    {
      name: "calls",
      label: "Calls",
      help: "Every call, the moment it ends — who called and what happened.",
      on: pref?.calls ?? true,
    },
    {
      name: "bookings",
      label: "Bookings",
      help: "A job the receptionist booked into your calendar.",
      on: pref?.bookings ?? true,
    },
    {
      name: "pendingConfirmations",
      label: "Bookings waiting for your OK",
      help: "When you've chosen “hold it pending”, the booking that needs confirming.",
      on: pref?.pendingConfirmations ?? true,
    },
  ];

  return (
    <div className="max-w-2xl">
      <SettingsTabs />
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Notifications
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Push notifications on your phone or computer. Turn them on per device, and choose
        which events you want.
      </p>
      {saved && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Saved.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {publicKey ? (
          <PushControls publicKey={publicKey} />
        ) : (
          <p className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Push notifications aren&apos;t enabled on the server yet.
          </p>
        )}

        <form
          action={saveNotificationPrefs}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            What to send
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Applies to every device you&apos;ve turned on
            {devices > 0 ? ` (${devices} so far)` : ""}. You&apos;ll still get the email
            summary either way.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {toggles.map((t) => (
              <label key={t.name} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name={t.name}
                  defaultChecked={t.on}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
                />
                <span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.label}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">{t.help}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="mt-5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Save preferences
          </button>
        </form>
      </div>
    </div>
  );
}
