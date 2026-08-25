// Google Calendar API client (plain fetch, no SDK). OAuth 2.0 with offline
// refresh tokens; scopes: calendar + userinfo.email.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not set");
  return v;
}

function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return v;
}

export function redirectUri(): string {
  return `${process.env.PLATFORM_URL ?? "https://tworing.ai"}/api/google/oauth/callback`;
}

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // always returns a refresh token
    state,
  });
  return `${AUTH_URL}?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new Error(`google token endpoint ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

export async function exchangeCode(
  code: string,
): Promise<{ refreshToken: string; accessToken: string; email: string }> {
  const tok = await tokenRequest({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  if (!tok.refresh_token) {
    throw new Error("google did not return a refresh token");
  }
  const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  const { email } = (await info.json()) as { email?: string };
  return {
    refreshToken: tok.refresh_token,
    accessToken: tok.access_token,
    email: email ?? "unknown",
  };
}

export async function accessTokenFromRefresh(refreshToken: string): Promise<string> {
  const tok = await tokenRequest({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: "refresh_token",
  });
  return tok.access_token;
}

async function calApi<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    throw new Error(`google calendar ${path} ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function listCalendars(accessToken: string) {
  const data = await calApi<{
    items: { id: string; summary: string; primary?: boolean; accessRole: string }[];
  }>(accessToken, "/users/me/calendarList?minAccessRole=writer");
  return data.items ?? [];
}

// Busy intervals on the target calendar between timeMin and timeMax.
export async function freeBusy(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<{ start: Date; end: Date }[]> {
  const data = await calApi<{
    calendars: Record<string, { busy: { start: string; end: string }[] }>;
  }>(accessToken, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    }),
  });
  const busy = data.calendars?.[calendarId]?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export type GcalEvent = {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: GcalEvent,
): Promise<string> {
  const data = await calApi<{ id: string }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(event) },
  );
  return data.id;
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<GcalEvent>,
): Promise<void> {
  await calApi(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(event) },
  );
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    await calApi(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
  } catch (err) {
    // already gone is fine
    if (!String(err).includes(" 404") && !String(err).includes(" 410")) throw err;
  }
}
