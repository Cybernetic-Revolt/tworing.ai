# Runs inside LXC 129: order the Calgary DID for Kelly's org, mirroring Billy's
# routing/billing, with SMS + inbound callback enabled. Prints the result and
# verifies SMS is on. Ordering is a paid action — run once.
import json
import urllib.parse
import urllib.request

DID = "5878852387"
with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
USER, PASS = env["VOIPMS_API_USERNAME"], env["VOIPMS_API_PASSWORD"]
CALLBACK = f"https://tworing.ai/api/sms/inbound?secret={env['SMS_INBOUND_SECRET']}"


def call(method, **params):
    q = {"api_username": USER, "api_password": PASS, "method": method, **params}
    req = urllib.request.Request(
        f"https://voip.ms/api/v1/rest.php?{urllib.parse.urlencode(q)}",
        headers={"User-Agent": "curl/8.5.0"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


# Don't double-order if it's already on the account.
existing = call("getDIDsInfo", did=DID)
if existing.get("status") == "success" and existing.get("dids"):
    print("already owned:", DID)
else:
    res = call(
        "orderDID",
        did=DID,
        routing="account:548365_bilco1",
        pop="16",
        dialtime="60",
        cnam="0",
        billing_type="1",
        sms_enabled="1",
        sms_url_callback_enabled="1",
        sms_url_callback=CALLBACK,
        sms_url_callback_retry="1",
    )
    print("orderDID:", json.dumps(res))

# Verify SMS config landed.
info = call("getDIDsInfo", did=DID).get("dids", [{}])[0]
print(f"verify: did={info.get('did')} sms_enabled={info.get('sms_enabled')} "
      f"callback_enabled={info.get('sms_url_callback_enabled')} "
      f"callback={info.get('sms_url_callback')}")
