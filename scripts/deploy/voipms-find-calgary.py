# Runs inside LXC 129: find available VoIP.ms DIDs in Calgary (AB) so we can
# order one for Kelly's org. Read-only (lists + prices, orders nothing).
import json
import urllib.parse
import urllib.request

with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
USER, PASS = env["VOIPMS_API_USERNAME"], env["VOIPMS_API_PASSWORD"]


def call(method, **params):
    q = {"api_username": USER, "api_password": PASS, "method": method, **params}
    req = urllib.request.Request(
        f"https://voip.ms/api/v1/rest.php?{urllib.parse.urlencode(q)}",
        headers={"User-Agent": "curl/8.5.0"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


# Find the Calgary rate center in Alberta.
rc = call("getRateCentersCAN", province="AB")
print("ratecenters status:", rc.get("status"))
calgary = [c for c in rc.get("ratecenters", []) if "calgary" in c.get("ratecenter", "").lower()]
for c in calgary:
    print("  ratecenter:", c)

# List available DIDs in Calgary.
for c in calgary[:1]:
    dids = call("getDIDsCAN", province="AB", ratecenter=c["ratecenter"])
    print("dids status:", dids.get("status"))
    for d in dids.get("dids", [])[:8]:
        print(f"  DID {d.get('did')}  sms={d.get('sms')}  "
              f"setup={d.get('setup')}  monthly={d.get('monthly')}  "
              f"minute={d.get('minute')}")
