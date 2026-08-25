# Runs inside LXC 129: list every assistant + every phone number and which
# assistant each is routed to, so we can see if the "Kelly" the caller reaches
# is a different assistant than the one we've been editing (de15dfc8).
import json
import urllib.request

with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]


def req(path):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path,
        headers={"Authorization": f"Bearer {API_KEY}", "User-Agent": "curl/8.5.0"},
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


print("== ASSISTANTS ==")
for a in req("/assistant"):
    tools = [t.get("function", {}).get("name") or t.get("type") for t in a.get("model", {}).get("tools", [])]
    print(f"{a['id']}  {a.get('name','?')!r}  tools={tools}")

print("\n== PHONE NUMBERS ==")
for p in req("/phone-number"):
    print(f"{p.get('number','?')}  assistantId={p.get('assistantId')}  name={p.get('name','?')!r}")
