# Runs inside LXC 129: restore the DID failover to its original target
# (fwd:2325739 = 403-616-5487, the founder's cell) — that pre-existing config
# was correct: the business line forwards INTO the AI numbers, so failing
# over to it could loop during an outage. A human's cell is the right target.
import json
import urllib.parse
import urllib.request

DID = "2899991089"
ORIGINAL = "fwd:2325739"

with open("/etc/bilco-platform.env") as f:
    env = dict(
        line.strip().split("=", 1)
        for line in f
        if "=" in line and not line.startswith("#")
    )

BASE = "https://voip.ms/api/v1/rest.php"
COMMON = {
    "api_username": env["VOIPMS_API_USERNAME"],
    "api_password": env["VOIPMS_API_PASSWORD"],
}


def call(method, **params):
    q = urllib.parse.urlencode({**COMMON, "method": method, **params})
    req = urllib.request.Request(
        f"{BASE}?{q}", headers={"User-Agent": "curl/8.5.0"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    if data.get("status") != "success":
        raise SystemExit(f"{method} failed: {data}")
    return data


info = call("getDIDsInfo", did=DID)["dids"][0]
call(
    "setDIDInfo",
    did=DID,
    routing=info["routing"],
    pop=info["pop"],
    dialtime=info["dialtime"],
    cnam=info["cnam"],
    billing_type=info["billing_type"],
    failover_busy=ORIGINAL,
    failover_unreachable=ORIGINAL,
    failover_noanswer=ORIGINAL,
)
after = call("getDIDsInfo", did=DID)["dids"][0]
print("routing:", after["routing"])
print(
    "failover restored (busy/unreach/noanswer):",
    after.get("failover_busy"),
    after.get("failover_unreachable"),
    after.get("failover_noanswer"),
)
