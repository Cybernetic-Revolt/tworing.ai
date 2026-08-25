# Runs inside LXC 129: register the sending domain with Resend (idempotent)
# and print the DNS records to add. Reads RESEND_API_KEY from the env file.
import json
import urllib.request

DOMAIN = "mail.tworing.ai"
ENV = "/etc/bilco-platform.env"

key = None
for line in open(ENV):
    if line.startswith("RESEND_API_KEY="):
        key = line.strip().split("=", 1)[1]
BASE = "https://api.resend.com"


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        f"{BASE}{path}",
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


# Find existing or create.
existing = next(
    (d for d in api("/domains").get("data", []) if d["name"] == DOMAIN), None
)
dom = api(f"/domains/{existing['id']}") if existing else api(
    "/domains", "POST", {"name": DOMAIN}
)
print(f"domain {DOMAIN}: id={dom['id']} status={dom.get('status')}")
print("\n--- DNS records to add in Cloudflare (tworing.ai zone) ---")
for r in dom.get("records", []):
    name = r.get("name", "")
    print(f"\n[{r.get('type')}] {r.get('record','')}")
    print(f"  name:  {name}")
    print(f"  value: {r.get('value')}")
    if r.get("priority"):
        print(f"  priority: {r.get('priority')}")
    print(f"  ttl: {r.get('ttl', 'Auto')}  status: {r.get('status')}")
