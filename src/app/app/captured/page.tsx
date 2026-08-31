import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { deleteNote, setTaskStatus } from "./actions";

/**
 * Everything the assistant took down that isn't a booking or a lead.
 *
 * These tables have been filling up since the capture tools shipped and nothing has ever
 * rendered them: `assistant-tools.ts` was both the only writer and the only reader. An
 * assistant that says "got it, filed under Ops" and files it somewhere nobody can look is
 * worse than one that admits it cannot — the principal stops asking.
 *
 * Notes and tasks share a page because they differ only in intent, which is what the schema
 * says too: a task is something to do, a reminder is a task whose point is the time. They
 * arrive from the same sentence in the same call and are read in one sitting.
 */

const KIND_STYLES: Record<string, string> = {
  NOTE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  TASK: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  REMINDER: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const FILTERS = ["ALL", "OPEN", "NOTES", "DONE"] as const;

export default async function CapturedPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const session = await requireSession();
  const { show } = await searchParams;
  const active = (FILTERS as readonly string[]).includes(show ?? "") ? show! : "ALL";
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  const [org, notes, tasks] = await Promise.all([
    prisma.org.findUnique({ where: { id: session.orgId } }),
    prisma.note.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.task.findMany({
      where: { orgId: session.orgId },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);
  const tz = org?.timezone ?? "America/Edmonton";

  // One list, because that is how they were spoken and how they are read. Sorting by when
  // the assistant captured it keeps a note and the task from the same sentence together.
  type Row =
    | { kind: "NOTE"; id: string; at: Date; body: string; project: string | null; call: string | null }
    | {
        kind: "TASK" | "REMINDER";
        id: string;
        at: Date;
        body: string;
        project: string | null;
        call: string | null;
        due: Date | null;
        status: string;
      };

  let rows: Row[] = [
    ...notes.map((n) => ({
      kind: "NOTE" as const,
      id: n.id,
      at: n.createdAt,
      body: n.text,
      project: n.project,
      call: n.sourceCallId,
    })),
    ...tasks.map((t) => ({
      kind: t.kind as "TASK" | "REMINDER",
      id: t.id,
      at: t.createdAt,
      body: t.title,
      project: t.project,
      call: t.sourceCallId,
      due: t.dueAt,
      status: t.status,
    })),
  ];

  if (active === "OPEN") rows = rows.filter((r) => r.kind !== "NOTE" && r.status === "OPEN");
  else if (active === "NOTES") rows = rows.filter((r) => r.kind === "NOTE");
  else if (active === "DONE") rows = rows.filter((r) => r.kind !== "NOTE" && r.status !== "OPEN");

  rows.sort((a, b) => b.at.getTime() - a.at.getTime());

  const openCount = tasks.filter((t) => t.status === "OPEN").length;
  const overdue = tasks.filter(
    (t) => t.status === "OPEN" && t.dueAt && t.dueAt.getTime() < Date.now(),
  ).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Captured</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Notes, tasks and reminders your assistant took down on a call.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => {
          const count =
            f === "ALL"
              ? notes.length + tasks.length
              : f === "NOTES"
                ? notes.length
                : f === "OPEN"
                  ? openCount
                  : tasks.length - openCount;
          return (
            <Link
              key={f}
              href={f === "ALL" ? "/app/captured" : `/app/captured?show=${f}`}
              className={`rounded-full px-3 py-1 ${
                active === f
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {f === "ALL" ? "All" : f === "OPEN" ? "To do" : f === "NOTES" ? "Notes" : "Closed"}{" "}
              {count}
            </Link>
          );
        })}
        {overdue > 0 && (
          <span className="rounded-full bg-red-50 px-3 py-1 text-red-700 dark:bg-red-950 dark:text-red-300">
            {overdue} overdue
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing captured yet. Ask your assistant to take a note, add a task or set a
          reminder on a call and it will appear here.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {rows.map((r) => {
            // Narrowed once and reused: TypeScript already knows a row with a status is not
            // a note, and re-testing it is how a redundant check hides a real one later.
            const task = r.kind === "NOTE" ? null : r;
            const isOpen = task?.status === "OPEN";
            const isOverdue = Boolean(isOpen && task?.due && task.due.getTime() < Date.now());
            return (
              <li
                key={`${r.kind}-${r.id}`}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_STYLES[r.kind]}`}
                      >
                        {r.kind === "NOTE" ? "Note" : r.kind === "TASK" ? "Task" : "Reminder"}
                      </span>
                      {r.project && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {r.project}
                        </span>
                      )}
                      {task && task.status !== "OPEN" && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {task.status === "DONE" ? "Done" : "Cancelled"}
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-2 text-sm ${
                        task && task.status !== "OPEN"
                          ? "text-zinc-400 line-through dark:text-zinc-500"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      {r.body}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatWhen(r.at, tz)}
                      {task?.due && (
                        <>
                          {" · "}
                          <span className={isOverdue ? "font-medium text-red-600 dark:text-red-400" : ""}>
                            due {formatWhen(task.due, tz)}
                          </span>
                        </>
                      )}
                      {/* The call it came from, so "who asked for this?" is one click, not a
                          search. sourceCallId is the engine's call id, not our row id. */}
                      {r.call && <> · from a call</>}
                    </p>
                  </div>

                  {canEdit && (
                    <div className="flex shrink-0 gap-2">
                      {r.kind === "NOTE" ? (
                        <form action={deleteNote}>
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                          >
                            Delete
                          </button>
                        </form>
                      ) : isOpen ? (
                        <>
                          <form action={setTaskStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="DONE" />
                            <button
                              type="submit"
                              className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                            >
                              Done
                            </button>
                          </form>
                          <form action={setTaskStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="CANCELLED" />
                            <button
                              type="submit"
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                            >
                              Drop
                            </button>
                          </form>
                        </>
                      ) : (
                        <form action={setTaskStatus}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value="OPEN" />
                          <button
                            type="submit"
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                          >
                            Reopen
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
