# Runs inside LXC 129: make inbound VOICE on Kelly's new SMS DID forward to her
# existing Vapi AI line (the 818) so calls stop dropping. SMS callback is left
# untouched. Reversible (just re-route the DID).
import json
import urllib.parse
import urllib.request

DID = "5878852387"
KELLY_AI = "18186079476"  # Kelly's Vapi voice number
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


# 1. Create a forwarding entry to Kelly's AI line.
fwd = call("setForwarding", phone_number=KELLY_AI, description="Kelly AI (818) - SMS DID voice")
print("setForwarding:", json.dumps(fwd))
fid = fwd.get("forwarding")
if not fid:
    raise SystemExit("no forwarding id returned")

# 2. Route the DID's voice to that forwarding.
route = call("setDIDRouting", did=DID, routing=f"fwd:{fid}")
print("setDIDRouting:", json.dumps(route))

# 3. Verify.
info = call("getDIDsInfo", did=DID).get("dids", [{}])[0]
print(f"verify: routing={info.get('routing')} sms_enabled={info.get('sms_enabled')}")
