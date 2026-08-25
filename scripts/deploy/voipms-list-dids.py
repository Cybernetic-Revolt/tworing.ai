# Runs inside LXC 129: list all VoIP.ms DIDs and whether SMS is available/enabled,
# plus which are already mapped to an org in our DB. Read-only.
import json
import urllib.parse
import urllib.request

with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))

qs = urllib.parse.urlencode({
    "api_username": env["VOIPMS_API_USERNAME"],
    "api_password": env["VOIPMS_API_PASSWORD"],
    "method": "getDIDsInfo",
})
req = urllib.request.Request(
    f"https://voip.ms/api/v1/rest.php?{qs}",
    headers={"User-Agent": "curl/8.5.0"},
)
with urllib.request.urlopen(req) as r:
    data = json.loads(r.read())

print("status:", data.get("status"))
for d in data.get("dids", []):
    print(f"  {d.get('did')}  sms_available={d.get('sms_available')} "
          f"sms_enabled={d.get('sms_enabled')}  routing={d.get('routing','?')}  "
          f"url_callback={d.get('sms_url_callback') or '-'}")
