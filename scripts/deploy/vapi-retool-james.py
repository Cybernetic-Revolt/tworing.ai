# Runs inside LXC 129: point the James assistant's booking tools at the
# James Plumbing org's own ingest key (it was provisioned with the bilco
# key before the demo orgs were split). Idempotent.
import json
import urllib.request

ASSISTANT_ID = "534db2e3-da19-4bb5-b5ea-4cb4c09896c8"

with open("/etc/bilco-platform.env") as f:
    env = dict(
        line.strip().split("=", 1)
        for line in f
        if "=" in line and not line.startswith("#")
    )
with open("/root/.tworing-key-james-plumbing") as f:
    JAMES_KEY = f.read().strip()


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path,
        method=method,
        headers={
            "Authorization": f"Bearer {env['VAPI_API_KEY']}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.5.0",
        },
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


a = req(f"/assistant/{ASSISTANT_ID}")
model = a["model"]
changed = False
for t in model.get("tools", []):
    server = t.get("server") or {}
    if server.get("secret") != JAMES_KEY:
        server["secret"] = JAMES_KEY
        t["server"] = server
        changed = True

if not changed:
    print("tools already use the James org key")
else:
    req(f"/assistant/{ASSISTANT_ID}", "PATCH", {"model": model})
    b = req(f"/assistant/{ASSISTANT_ID}")
    ok = all(
        (t.get("server") or {}).get("secret") == JAMES_KEY
        for t in b["model"].get("tools", [])
    )
    print("tools repointed to James org key:", ok)
