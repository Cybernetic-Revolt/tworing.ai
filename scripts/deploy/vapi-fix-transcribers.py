# Runs inside LXC 129: upgrade speech-to-text on all three assistants.
# - model flux-general-en -> nova-3 (highest accuracy)
# - numerals true (capture "123" / "587..." as digits, not words)
# - keyterm boosting for each business's vocabulary + Calgary place names
# Verifies each PATCH. Reversible (re-PATCH transcriber).
import json
import urllib.request

with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]

GEO = ["Calgary", "Okotoks", "Bridgeland", "Lake Bonavista", "Canyon Meadows",
       "Willow Park", "Maple Ridge", "Deer Run", "Queensland", "Riverbend",
       "Southwest", "Southeast", "Northwest", "Northeast"]

KELLY = ["Joe's Lawn and Snow", "mowing", "biweekly", "aeration", "power raking",
         "dethatching", "fertilizer", "weed control", "snow removal", "ice removal",
         "ice melt", "landscaping", "mulch", "sod", "hedge trimming", "mosquito control",
         "spring cleanup", "fall cleanup", "quote", "driveway", "sidewalk"]
JAMES = ["James Plumbing", "drain", "clog", "faucet", "water heater", "hot water tank",
         "leak", "sump pump", "toilet", "valve", "shut off valve", "pipe", "backed up",
         "flooding", "garburator", "no hot water", "burst pipe", "emergency"]
SARAH = ["Billy's Realty", "showing", "listing", "open house", "offer", "mortgage",
         "pre-approval", "property", "condo", "townhouse", "square feet", "buyer",
         "seller", "consultation", "walkthrough"]

ASSISTANTS = {
    "Kelly": ("de15dfc8-6bb8-494b-9efa-32e1ba943aa9", KELLY + GEO),
    "James": ("534db2e3-da19-4bb5-b5ea-4cb4c09896c8", JAMES + GEO),
    "Sarah": ("cbeca395-1970-45f6-9b32-c2471eda4b43", SARAH + GEO),
}


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path, method=method,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


for name, (aid, terms) in ASSISTANTS.items():
    transcriber = {
        "provider": "deepgram",
        "model": "nova-3",
        "language": "en",
        "numerals": True,
        "endpointing": 300,
        "confidenceThreshold": 0.4,
        "keyterm": terms,
        "fallbackPlan": {"autoFallback": {"enabled": True}},
    }
    try:
        req(f"/assistant/{aid}", "PATCH", {"transcriber": transcriber})
    except urllib.error.HTTPError as e:
        print(f"{name}: PATCH FAILED {e.code}: {e.read().decode()[:300]}")
        continue
    t = req(f"/assistant/{aid}").get("transcriber", {})
    print(f"{name}: model={t.get('model')} numerals={t.get('numerals')} keyterms={len(t.get('keyterm') or [])}")
