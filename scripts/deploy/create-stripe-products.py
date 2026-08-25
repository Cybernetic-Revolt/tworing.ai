# Runs inside LXC 129: create TwoRing's Stripe products/prices idempotently
# (keyed by price lookup_key) and write the resulting price IDs back into
# /etc/bilco-platform.env. Reads STRIPE_SECRET_KEY from the env file.
import urllib.parse
import urllib.request

ENV = "/etc/bilco-platform.env"


def load_env():
    d = {}
    for line in open(ENV):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            d[k] = v
    return d


env = load_env()
SK = env["STRIPE_SECRET_KEY"]
BASE = "https://api.stripe.com/v1"


def api(path, params=None):
    data = urllib.parse.urlencode(params, doseq=True).encode() if params else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Authorization": f"Bearer {SK}"},
        method="POST" if params is not None else "GET",
    )
    with urllib.request.urlopen(req) as r:
        import json

        return json.load(r)


def get_price_by_lookup(lk):
    res = api(f"/prices?lookup_keys[]={lk}&limit=1")
    items = res.get("data", [])
    return items[0]["id"] if items else None


# plan: (env var, product name, description, lookup_key, unit_amount_cents, metered?)
PLANS = [
    ("STRIPE_PRICE_ANSWER", "TwoRing Answer",
     "24/7 AI receptionist. Answers calls, books jobs, emails leads. 300 AI minutes/month.",
     "tworing_answer_v1", 17900, False),
    ("STRIPE_PRICE_OFFICE", "TwoRing Office",
     "Everything in Answer plus web portal, recordings, two-way SMS, Google Calendar sync. 600 AI minutes/month.",
     "tworing_office_v1", 34900, False),
    ("STRIPE_PRICE_OPERATIONS", "TwoRing Operations",
     "Everything in Office plus lead pipeline, Jobber sync, review-request engine. 1,200 AI minutes/month.",
     "tworing_operations_v1", 59900, False),
    # Overage is v1 soft-cap (manual billing per spec §7); Stripe metered
    # usage is deferred to v2 (needs a Billing Meter object).
    ("STRIPE_PRICE_EXTRA_NUMBER", "TwoRing Additional Number",
     "An extra business line answered by your AI receptionist.",
     "tworing_extra_number_v1", 2500, False),
]

results = {}
for env_key, name, desc, lookup, amount, metered in PLANS:
    existing = get_price_by_lookup(lookup)
    if existing:
        results[env_key] = existing
        print(f"{name}: reuse {existing}")
        continue
    prod = api("/products", {"name": name, "description": desc})
    price_params = {
        "product": prod["id"],
        "currency": "cad",
        "unit_amount": amount,
        "lookup_key": lookup,
        "recurring[interval]": "month",
    }
    if metered:
        price_params["recurring[usage_type]"] = "metered"
    price = api("/prices", price_params)
    results[env_key] = price["id"]
    print(f"{name}: created {price['id']}")

# Write price IDs back into the env file.
lines = open(ENV).read().splitlines()
out = []
seen = set()
for line in lines:
    k = line.split("=", 1)[0] if "=" in line else None
    if k in results:
        out.append(f"{k}={results[k]}")
        seen.add(k)
    else:
        out.append(line)
for k, v in results.items():
    if k not in seen:
        out.append(f"{k}={v}")
open(ENV, "w").write("\n".join(out) + "\n")

print("\n--- price IDs written to env ---")
for k, v in results.items():
    print(f"{k}={v}")
