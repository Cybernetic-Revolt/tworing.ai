import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsTabs } from "../settings-tabs";
import { changeRole, inviteMember, removeMember } from "./actions";

export const metadata = { title: "Team — TwoRing" };

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ADMIN: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  MEMBER: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};
const RANK: Record<string, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  weak: "Set a temporary password of at least 10 characters.",
  perm: "You don't have permission for that change.",
  exists: "That person is already on your team.",
  lastowner: "You can't remove or demote the last owner.",
  self: "You can't change your own role here.",
};
const OK: Record<string, string> = {
  invited: "Teammate added — share their temporary password so they can sign in.",
  saved: "Role updated.",
  removed: "Teammate removed.",
};

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await requireSession();
  const { error, invited, saved, removed } = await searchParams;
  const flash = invited ? "invited" : saved ? "saved" : removed ? "removed" : null;

  const canEdit = session.role === "OWNER" || session.role === "ADMIN";
  const isOwner = session.role === "OWNER";

  const membersRaw = await prisma.membership.findMany({
    where: { orgId: session.orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const members = membersRaw.sort(
    (a, b) => (RANK[a.role] ?? 9) - (RANK[b.role] ?? 9) || a.user.email.localeCompare(b.user.email),
  );

  // Which roles the current actor may assign.
  const assignable = isOwner ? ["OWNER", "ADMIN", "MEMBER"] : ["ADMIN", "MEMBER"];

  return (
    <div className="max-w-2xl">
      <SettingsTabs />
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Team
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Everyone who can sign in to {`“`}your business{`”`} portal, and what they can do.
      </p>

      {error && ERRORS[error] && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {ERRORS[error]}
        </p>
      )}
      {flash && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {OK[flash]}
        </p>
      )}

      {/* Roles legend */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span><strong className="text-zinc-700 dark:text-zinc-300">Owner</strong> — full access, billing, team</span>
        <span><strong className="text-zinc-700 dark:text-zinc-300">Admin</strong> — everything except billing/owners</span>
        <span><strong className="text-zinc-700 dark:text-zinc-300">Member</strong> — view calls, leads & calendar</span>
      </div>

      <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
        {members.map((m) => {
          const isSelf = m.userId === session.userId;
          const targetIsOwner = m.role === "OWNER";
          // Can the actor manage this member? Owners manage anyone but not self;
          // admins manage non-owners but not self.
          const manageable = canEdit && !isSelf && (isOwner || !targetIsOwner);
          return (
            <li key={m.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {m.user.name ?? m.user.email}
                  {isSelf && <span className="ml-2 text-xs font-normal text-zinc-400">you</span>}
                </p>
                {m.user.name && (
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{m.user.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {manageable ? (
                  <>
                    <form action={changeRole} className="flex items-center gap-2">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select name="role" defaultValue={m.role} className={inputClass}>
                        {assignable.map((r) => (
                          <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                      <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                        Save
                      </button>
                    </form>
                    <form action={removeMember}>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <button type="submit" className="rounded-md px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
                        Remove
                      </button>
                    </form>
                  </>
                ) : (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_BADGE[m.role]}`}>
                    {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {canEdit ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Add a teammate
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            They sign in with the email and temporary password you set here, then
            change it under Account.
          </p>
          <form action={inviteMember} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              Email
              <input name="email" type="email" required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              Name <span className="text-zinc-400">(optional)</span>
              <input name="name" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              Role
              <select name="role" defaultValue="MEMBER" className={inputClass}>
                {assignable.map((r) => (
                  <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              Temporary password
              <input name="password" type="text" minLength={10} required autoComplete="off" className={inputClass} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                Add teammate
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Only owners and admins can change the team. Ask one of them if you need access.
        </p>
      )}
    </div>
  );
}
