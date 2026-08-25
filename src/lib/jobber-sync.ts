// Jobber sync: TwoRing leads become Jobber Clients (clientCreate — confirmed
// schema; Jobber auto-tags our app as the lead source), and a booked
// appointment upgrades the client to a Request (requestCreate). Operations/
// Custom tier only, when the org has connected Jobber. Refreshes the access
// token on 401. Fire-and-forget; failures record lastError on the connection,
// never throw.
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { graphql, refreshAccess } from "@/lib/jobber";

const CLIENT_CREATE = `
mutation CreateClient($input: ClientCreateInput!) {
  clientCreate(input: $input) {
    client { id }
    userErrors { message }
  }
}`;

const REQUEST_CREATE = `
mutation CreateRequest($input: RequestCreateInput!) {
  requestCreate(input: $input) {
    request { id }
    userErrors { message }
  }
}`;

type LeadLike = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  jobType?: string | null;
};

type Conn = NonNullable<
  Awaited<ReturnType<typeof prisma.jobberConnection.findUnique>>
>;

function nameParts(name?: string | null): { first?: string; last?: string } {
  const n = (name ?? "").trim();
  if (!n) return {};
  const parts = n.split(/\s+/);
  return parts.length === 1
    ? { first: parts[0] }
    : { first: parts[0], last: parts.slice(1).join(" ") };
}

// Loads the org's active Jobber connection, or null when sync shouldn't run.
async function activeConnection(orgId: string): Promise<Conn | null> {
  const [org, conn] = await Promise.all([
    prisma.org.findUnique({ where: { id: orgId } }),
    prisma.jobberConnection.findUnique({ where: { orgId } }),
  ]);
  if (!org || !conn || !conn.syncEnabled) return null;
  if (org.tier !== "OPERATIONS" && org.tier !== "CUSTOM") return null;
  return conn;
}

// Runs `fn` with a valid access token, refreshing (and re-persisting) it once
// on an auth failure.
async function withAccess<T>(
  orgId: string,
  conn: Conn,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(decryptSecret(conn.accessToken));
  } catch (err) {
    if (!/\b401\b|UNAUTHENTICATED|expired/i.test(String(err))) throw err;
    const tok = await refreshAccess(decryptSecret(conn.refreshToken));
    await prisma.jobberConnection.update({
      where: { orgId },
      data: {
        accessToken: encryptSecret(tok.access_token),
        refreshToken: encryptSecret(tok.refresh_token),
      },
    });
    return fn(tok.access_token);
  }
}

async function markSynced(orgId: string, userErrors: { message: string }[]) {
  await prisma.jobberConnection.update({
    where: { orgId },
    data: {
      lastSyncAt: new Date(),
      lastError: userErrors.length
        ? userErrors.map((e) => e.message).join("; ").slice(0, 300)
        : null,
    },
  });
}

async function markFailed(orgId: string, err: unknown) {
  await prisma.jobberConnection
    .update({ where: { orgId }, data: { lastError: String(err).slice(0, 300) } })
    .catch(() => {});
}

// Creates the Jobber client for a lead and returns its id (or null on
// userErrors). Does not catch — callers own error recording.
async function createClient(
  orgId: string,
  conn: Conn,
  lead: LeadLike,
): Promise<string | null> {
  const { first, last } = nameParts(lead.name);
  const input: Record<string, unknown> = {
    firstName: first,
    lastName: last,
    companyName: first ? undefined : `Lead ${lead.phone ?? ""}`.trim(),
  };
  if (lead.email) {
    input.emails = [{ address: lead.email, primary: true, description: "MAIN" }];
  }
  if (lead.phone) {
    input.phones = [{ number: lead.phone, primary: true, description: "MAIN" }];
  }

  const result = await withAccess(orgId, conn, (at) =>
    graphql<{
      clientCreate: { client?: { id: string }; userErrors: { message: string }[] };
    }>(at, CLIENT_CREATE, { input }),
  );
  await markSynced(orgId, result.clientCreate?.userErrors ?? []);
  return result.clientCreate?.client?.id ?? null;
}

// New lead -> Jobber Client. Persists the client id on the lead so a later
// booking can upgrade it to a Request.
export async function pushLeadToJobber(
  orgId: string,
  leadId: string,
  lead: LeadLike,
): Promise<void> {
  const conn = await activeConnection(orgId);
  if (!conn) return;
  try {
    const clientId = await createClient(orgId, conn, lead);
    if (clientId) {
      await prisma.lead.update({
        where: { id: leadId, orgId },
        data: { jobberClientId: clientId },
      });
    }
  } catch (err) {
    await markFailed(orgId, err);
  }
}

// Booked appointment -> Jobber Request against the lead's client (creating
// the client first if the lead predates the Jobber connection).
export async function pushBookingToJobber(
  orgId: string,
  appointmentId: string,
): Promise<void> {
  const conn = await activeConnection(orgId);
  if (!conn) return;

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      lead: true,
      org: { select: { timezone: true } },
    },
  });
  // Org-scope check: never act on another org's appointment.
  if (!appt || appt.orgId !== orgId || !appt.lead) return;
  if (appt.jobberRequestId) return; // already pushed

  try {
    let clientId = appt.lead.jobberClientId;
    if (!clientId) {
      clientId = await createClient(orgId, conn, appt.lead);
      if (!clientId) return; // userErrors already recorded
      await prisma.lead.update({
        where: { id: appt.lead.id, orgId },
        data: { jobberClientId: clientId },
      });
    }

    const when = formatWhen(appt.startsAt, appt.org.timezone);
    const title =
      `${appt.jobType ?? appt.title} — booked by TwoRing for ${when}`.slice(0, 255);

    const result = await withAccess(orgId, conn, (at) =>
      graphql<{
        requestCreate: {
          request?: { id: string };
          userErrors: { message: string }[];
        };
      }>(at, REQUEST_CREATE, { input: { clientId, title } }),
    );
    await markSynced(orgId, result.requestCreate?.userErrors ?? []);

    const requestId = result.requestCreate?.request?.id;
    if (requestId) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { jobberRequestId: requestId },
      });
    }
  } catch (err) {
    await markFailed(orgId, err);
  }
}
