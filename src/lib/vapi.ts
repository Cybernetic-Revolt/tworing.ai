const VAPI_BASE = "https://api.vapi.ai";

function apiKey(): string {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY is not set");
  return key;
}

async function vapi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Vapi ${init?.method ?? "GET"} ${path} -> ${res.status}: ${body}`,
    );
  }
  return res.json() as Promise<T>;
}

export type VapiAssistant = {
  id: string;
  name?: string;
  server?: { url?: string };
  [k: string]: unknown;
};

export type VapiPhoneNumber = {
  id: string;
  number?: string;
  assistantId?: string;
  [k: string]: unknown;
};

export const listAssistants = () => vapi<VapiAssistant[]>("/assistant");

export const getAssistant = (id: string) =>
  vapi<VapiAssistant>(`/assistant/${id}`);

export const createAssistant = (body: Record<string, unknown>) =>
  vapi<VapiAssistant>("/assistant", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateAssistant = (id: string, body: Record<string, unknown>) =>
  vapi<VapiAssistant>(`/assistant/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const listVapiNumbers = () => vapi<VapiPhoneNumber[]>("/phone-number");

// Server-message destination for an assistant. Vapi echoes the secret back
// as X-Vapi-Secret on every webhook, which our ingest route accepts as the
// tenant's ingest key.
export function platformServerConfig(ingestKey: string) {
  const base = process.env.PLATFORM_URL;
  if (!base) throw new Error("PLATFORM_URL is not set");
  return {
    server: {
      url: `${base.replace(/\/$/, "")}/api/ingest/vapi`,
      secret: ingestKey,
    },
  };
}
