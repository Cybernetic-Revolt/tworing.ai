import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createAppointment } from "../actions";
import { AppointmentFields } from "../appointment-fields";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/calendar");
  }
  const { error } = await searchParams;

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        New appointment
      </h1>
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Date, time, and customer name are required.
        </p>
      )}
      <form action={createAppointment} className="mt-6 flex flex-col gap-4">
        <AppointmentFields />
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Book it
          </button>
          <a
            href="/app/calendar"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
