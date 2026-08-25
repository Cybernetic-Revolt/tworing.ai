# Runs inside LXC 129: dump the full VoIP.ms config of the working Billy's DID
# so we can mirror routing/pop/billing when ordering Kelly's number. Read-only.
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


info = call("getDIDsInfo", did="2899991089")
print(json.dumps(info.get("dids", [{}])[0], indent=2))
