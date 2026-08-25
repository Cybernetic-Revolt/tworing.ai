// Jobber OAuth 2.0 + GraphQL client (plain fetch, no SDK). Tokens are stored
// encrypted per-org (JobberConnection). Jobber has no REST API — everything
// is GraphQL at api.getjobber.com/api/graphql.
const AUTH_URL = "https://api.getjobber.com/api/oauth/authorize";
const TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
const GQL_URL = "https://api.getjobber.com/api/graphql";
const GQL_VERSION = "2025-01-20"; // X-JOBBER-GRAPHQL-VERSION

export function jobberConfigured(): boolean {
  return !!process.env.JOBBER_CLIENT_ID && !!process.env.JOBBER_CLIENT_SECRET;
}

function clientId(): string {
  const v = process.env.JOBBER_CLIENT_ID;
  if (!v) throw new Error("JOBBER_CLIENT_ID is not set");
  return v;
}
function clientSecret(): string {
  const v = process.env.JOBBER_CLIENT_SECRET;
  if (!v) throw new Error("JOBBER_CLIENT_SECRET is not set");
  return v;
}
export function redirectUri(): string {
  return `${process.env.PLATFORM_URL ?? "https://tworing.ai"}/api/jobber/oauth/callback`;
}

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    state,
  });
  return `${AUTH_URL}?${p}`;
}

type TokenResp = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export async function exchangeCode(code: string): Promise<TokenResp> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`jobber token ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TokenResp>;
}

export async function refreshAccess(refreshToken: string): Promise<TokenResp> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`jobber refresh ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TokenResp>;
}

export async function graphql<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": GQL_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`jobber graphql ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(`jobber graphql errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

// The connected Jobber account's id/name — also a connectivity check.
export async function getAccount(
  accessToken: string,
): Promise<{ id: string; name: string }> {
  const data = await graphql<{ account: { id: string; name: string } }>(
    accessToken,
    `query { account { id name } }`,
  );
  return data.account;
}
