# Runs inside LXC 129: enable SMS + inbound callback on Kelly's new DID via
# setSMS, then verify. Idempotent.
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


res = call(
    "setSMS",
    did=DID,
    enable="1",
    email_enabled="0",
    url_callback_enable="1",
    url_callback=CALLBACK,
    url_callback_retry="1",
)
print("setSMS:", json.dumps(res))

info = call("getDIDsInfo", did=DID).get("dids", [{}])[0]
print(f"verify: did={info.get('did')} sms_enabled={info.get('sms_enabled')} "
      f"callback_enabled={info.get('sms_url_callback_enabled')} "
      f"callback={info.get('sms_url_callback')}")
