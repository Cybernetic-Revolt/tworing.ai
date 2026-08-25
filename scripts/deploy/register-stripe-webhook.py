# Runs inside LXC 129: register the Stripe webhook endpoint, capture its
# signing secret, and write STRIPE_WEBHOOK_SECRET into the env file.
# Reads STRIPE_SECRET_KEY from env. Idempotent (recreates to get a fresh secret).
import json
import urllib.parse
import urllib.request

ENV = "/etc/bilco-platform.env"
URL = "https://tworing.ai/api/stripe/webhook"
EVENTS = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
]

env = {}
for line in open(ENV):
    if "=" in line and not line.startswith("#"):
        k, v = line.strip().split("=", 1)
        env[k] = v
SK = env["STRIPE_SECRET_KEY"]
BASE = "https://api.stripe.com/v1"


def api(path, method="GET", params=None):
    data = urllib.parse.urlencode(params, doseq=True).encode() if params is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}", data=data,
        headers={"Authorization": f"Bearer {SK}"},
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


# Remove any existing endpoint for this URL (so we get a fresh secret).
for ep in api("/webhook_endpoints?limit=100").get("data", []):
    if ep.get("url") == URL:
        api(f"/webhook_endpoints/{ep['id']}", "DELETE")
        print(f"removed existing endpoint {ep['id']}")

created = api("/webhook_endpoints", "POST", {"url": URL, "enabled_events[]": EVENTS})
secret = created["secret"]
print(f"created endpoint {created['id']} ({len(created['enabled_events'])} events)")

lines = open(ENV).read().splitlines()
out, seen = [], False
for line in lines:
    if line.startswith("STRIPE_WEBHOOK_SECRET="):
        out.append(f"STRIPE_WEBHOOK_SECRET={secret}")
        seen = True
    else:
        out.append(line)
if not seen:
    out.append(f"STRIPE_WEBHOOK_SECRET={secret}")
open(ENV, "w").write("\n".join(out) + "\n")
print(f"STRIPE_WEBHOOK_SECRET written ({secret[:8]}...)")
