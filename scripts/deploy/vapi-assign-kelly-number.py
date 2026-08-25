# Runs inside LXC 129: point Vapi number 818 at Kelly and route Kelly's
# end-of-call report through n8n (same webhook the others use; n8n then
# routes by assistantId to the joes-lawn-snow ingest key). Idempotent.
import json
import urllib.request

KELLY = "de15dfc8-6bb8-494b-9efa-32e1ba943aa9"
NUMBER_818 = "+18186079476"
N8N_WEBHOOK = "https://n8n.bilco.ca/webhook/1d9d12be-2896-4c1c-9d33-e9699c0fb21b"

with open("/etc/bilco-platform.env") as f:
    env = dict(
        line.strip().split("=", 1)
        for line in f if "=" in line and not line.startswith("#")
    )
API_KEY = env["VAPI_API_KEY"]


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path, method=method,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


# Reassign the 818 number to Kelly.
nums = req("/phone-number")
n818 = next((p for p in nums if p.get("number") == NUMBER_818), None)
if not n818:
    raise SystemExit(f"number {NUMBER_818} not found in Vapi account")
if n818.get("assistantId") != KELLY:
    req(f"/phone-number/{n818['id']}", "PATCH", {"assistantId": KELLY})
    print(f"reassigned {NUMBER_818} -> Kelly")
else:
    print(f"{NUMBER_818} already -> Kelly")

# Route Kelly's end-of-call through n8n.
a = req(f"/assistant/{KELLY}")
server = a.get("server") or {}
if server.get("url") != N8N_WEBHOOK:
    req(f"/assistant/{KELLY}", "PATCH", {"server": {"url": N8N_WEBHOOK}})
    print("set Kelly server webhook -> n8n")
else:
    print("Kelly webhook already -> n8n")

b = req(f"/assistant/{KELLY}")
print("Kelly server url:", (b.get("server") or {}).get("url"))
n818b = next((p for p in req("/phone-number") if p.get("number") == NUMBER_818), {})
print("818 assistantId:", n818b.get("assistantId"))
