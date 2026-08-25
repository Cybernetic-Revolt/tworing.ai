# Runs inside LXC 129: set carrier-level failover on the VoIP.ms DID so that
# if the SIP/AI leg is down (Vapi or platform outage), calls fall through to
# the founder's business line instead of dead air. Idempotent.
import json
import urllib.parse
import urllib.request

DID = "2899991089"
FAILOVER_NUMBER = "5875006941"  # founder's business line

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


# 1. Current DID config — echoed back verbatim so nothing else changes.
info = call("getDIDsInfo", did=DID)["dids"][0]
print("current routing:", info["routing"])
print(
    "current failover (busy/unreach/noanswer):",
    info.get("failover_busy"),
    info.get("failover_unreachable"),
    info.get("failover_noanswer"),
)

# 2. Forwarding entry for the business line (reuse if it exists).
fwds = call("getForwardings").get("forwardings", [])
fwd = next((f for f in fwds if FAILOVER_NUMBER in str(f.get("phone_number"))), None)
if fwd:
    fwd_id = fwd["forwarding"]
    print("forwarding exists:", fwd_id)
else:
    created = call(
        "setForwarding",
        phone_number=FAILOVER_NUMBER,
        description="TwoRing failover - business line",
    )
    fwd_id = created["forwarding"]
    print("forwarding created:", fwd_id)

target = f"fwd:{fwd_id}"
if (
    info.get("failover_busy") == target
    and info.get("failover_unreachable") == target
    and info.get("failover_noanswer") == target
):
    print("failover already set; nothing to do")
    raise SystemExit(0)

# 3. Apply failover, preserving the existing primary routing and settings.
call(
    "setDIDInfo",
    did=DID,
    routing=info["routing"],
    pop=info["pop"],
    dialtime=info["dialtime"],
    cnam=info["cnam"],
    billing_type=info["billing_type"],
    failover_busy=target,
    failover_unreachable=target,
    failover_noanswer=target,
)

# 4. Verify.
after = call("getDIDsInfo", did=DID)["dids"][0]
print("routing unchanged:", after["routing"] == info["routing"], "->", after["routing"])
print(
    "failover now (busy/unreach/noanswer):",
    after.get("failover_busy"),
    after.get("failover_unreachable"),
    after.get("failover_noanswer"),
)
