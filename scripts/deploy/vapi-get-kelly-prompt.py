# Runs inside LXC 129: print Kelly's current system prompt + key config.
import json
import urllib.request

KELLY = "de15dfc8-6bb8-494b-9efa-32e1ba943aa9"
with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]

req = urllib.request.Request(
    f"https://api.vapi.ai/assistant/{KELLY}",
    headers={"Authorization": f"Bearer {API_KEY}", "User-Agent": "curl/8.5.0"},
)
a = json.loads(urllib.request.urlopen(req).read())
print("firstMessage:", repr(a.get("firstMessage")))
for m in a.get("model", {}).get("messages", []):
    if m.get("role") == "system":
        print("=== SYSTEM PROMPT ===")
        print(m["content"])
