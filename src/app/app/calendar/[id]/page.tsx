import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatSlotLabel, wallTime } from "@/lib/tz";
import { setAppointmentStatus, updateAppointment } from "../actions";
import { AppointmentFields } from "../appointment-fields";

export default async function AppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [org, appt] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: session.orgId } }),
    prisma.appointment.findFirst({
      where: { id, orgId: session.orgId },
      include: { call: { select: { id: true } }, lead: { select: { id: true } } },
    }),
  ]);
  if (!appt) notFound();

  const tz = org.timezone;
  const wt = wallTime(appt.startsAt, tz);
  const date = `${wt.y}-${String(wt.mo).padStart(2, "0")}-${String(wt.d).padStart(2, "0")}`;
  const time = `${String(wt.h).padStart(2, "0")}:${String(wt.mi).padStart(2, "0")}`;
  const duration = Math.round(
    (appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000,
  );
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  return (
    <div className="max-w-lg">
      <Link href="/app/calendar" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← Calendar
      </Link>
      <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {appt.title}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {formatSlotLabel(appt.startsAt, tz)} · {duration} min · {appt.status}
        {appt.source === "AI" && " · booked by your receptionist"}
      </p>
      <div className="mt-2 flex gap-4 text-sm">
        {appt.call && (
          <Link href={`/app/calls/${appt.call.id}`} className="text-emerald-600 hover:underline dark:text-emerald-400">
            View the call
          </Link>
        )}
        {appt.lead && (
          <Link href="/app/leads" className="text-emerald-600 hover:underline dark:text-emerald-400">
            View lead
          </Link>
        )}
      </div>

      {canEdit ? (
        <>
          {appt.status === "PENDING" && (
            <form action={setAppointmentStatus} className="mt-4">
              <input type="hidden" name="id" value={appt.id} />
              <input type="hidden" name="status" value="CONFIRMED" />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Confirm this booking
              </button>
            </form>
          )}

          <form action={updateAppointment} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="id" value={appt.id} />
            <AppointmentFields
              defaults={{
                date,
                time,
                duration,
                customerName: appt.customerName,
                customerPhone: appt.customerPhone,
                jobType: appt.jobType,
                address: appt.address,
                notes: appt.notes,
              }}
            />
            <button
              type="submit"
              className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save changes
            </button>
          </form>

          <div className="mt-8 flex gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {appt.status !== "COMPLETED" && (
              <form action={setAppointmentStatus}>
                <input type="hidden" name="id" value={appt.id} />
                <input type="hidden" name="status" value="COMPLETED" />
                <button type="submit" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
                  Mark completed
                </button>
              </form>
            )}
            {appt.status !== "NO_SHOW" && (
              <form action={setAppointmentStatus}>
                <input type="hidden" name="id" value={appt.id} />
                <input type="hidden" name="status" value="NO_SHOW" />
                <button type="submit" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
                  No-show
                </button>
              </form>
            )}
            {appt.status !== "CANCELLED" && (
              <form action={setAppointmentStatus}>
                <input type="hidden" name="id" value={appt.id} />
                <input type="hidden" name="status" value="CANCELLED" />
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Cancel appointment
                </button>
              </form>
            )}
          </div>
        </>
      ) : (
        <dl className="mt-6 grid grid-cols-[7rem_1fr] gap-y-2 text-sm text-zinc-800 dark:text-zinc-200">
          <dt className="text-zinc-500 dark:text-zinc-400">Customer</dt>
          <dd>{appt.customerName ?? "—"}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Phone</dt>
          <dd>{appt.customerPhone ?? "—"}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Job</dt>
          <dd>{appt.jobType ?? "—"}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Address</dt>
          <dd>{appt.address ?? "—"}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Notes</dt>
          <dd>{appt.notes ?? "—"}</dd>
        </dl>
      )}
    </div>
  );
}
