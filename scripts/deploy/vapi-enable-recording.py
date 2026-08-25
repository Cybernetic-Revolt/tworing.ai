# Runs inside LXC 129: enable call recording on all assistants so recordingUrl
# is populated on the end-of-call report (for playback in the portal).
import json
import urllib.request

ASSISTANTS = {
    "Kelly": "de15dfc8-6bb8-494b-9efa-32e1ba943aa9",
    "James": "534db2e3-da19-4bb5-b5ea-4cb4c09896c8",
    "Sarah": "cbeca395-1970-45f6-9b32-c2471eda4b43",
}
with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path, method=method,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


for name, aid in ASSISTANTS.items():
    a = req(f"/assistant/{aid}")
    plan = a.get("artifactPlan") or {}
    plan["recordingEnabled"] = True
    req(f"/assistant/{aid}", "PATCH", {"artifactPlan": plan})
    b = req(f"/assistant/{aid}")
    print(f"{name}: recordingEnabled={b.get('artifactPlan', {}).get('recordingEnabled')}")
