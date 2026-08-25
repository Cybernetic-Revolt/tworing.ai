// VoIP.ms REST API. Requires API access enabled and the caller's IP
// whitelisted under Main Menu > SOAP and REST/JSON API on voip.ms.
const VOIPMS_BASE = "https://voip.ms/api/v1/rest.php";

type VoipMsResponse<T> = { status: string } & T;

async function voipms<T>(
  method: string,
  params: Record<string, string> = {},
): Promise<VoipMsResponse<T>> {
  const user = process.env.VOIPMS_API_USERNAME;
  const pass = process.env.VOIPMS_API_PASSWORD;
  if (!user || !pass) {
    throw new Error("VOIPMS_API_USERNAME / VOIPMS_API_PASSWORD not set");
  }
  const qs = new URLSearchParams({
    api_username: user,
    api_password: pass,
    method,
    content_type: "json",
    ...params,
  });
  const res = await fetch(`${VOIPMS_BASE}?${qs}`);
  if (!res.ok) throw new Error(`VoIP.ms ${method} -> HTTP ${res.status}`);
  const data = (await res.json()) as VoipMsResponse<T>;
  if (data.status !== "success") {
    throw new Error(`VoIP.ms ${method} -> ${data.status}`);
  }
  return data;
}

export type VoipMsDid = {
  did: string;
  description: string;
  routing: string;
  [k: string]: unknown;
};

export const getDids = () =>
  voipms<{ dids: VoipMsDid[] }>("getDIDsInfo").then((r) => r.dids);

export const getDid = (did: string) =>
  voipms<{ dids: VoipMsDid[] }>("getDIDsInfo", { did }).then((r) => r.dids[0]);

// routing examples: "sip:100000_sub" (SIP subaccount), "fwd:12345"
// (forwarding entry id from getForwardings)
export const setDidRouting = (did: string, routing: string) =>
  voipms("setDIDRouting", { did, routing });

export const getForwardings = () =>
  voipms<{ forwardings: Record<string, unknown>[] }>("getForwardings").then(
    (r) => r.forwardings,
  );

export function voipmsConfigured(): boolean {
  return !!process.env.VOIPMS_API_USERNAME && !!process.env.VOIPMS_API_PASSWORD;
}

// Send an SMS from one of our DIDs. `did` and `dst` are 10-digit (no +1).
export const sendSms = (did: string, dst: string, message: string) =>
  voipms<{ sms: number }>("sendSMS", { did, dst, message }).then((r) => r.sms);
