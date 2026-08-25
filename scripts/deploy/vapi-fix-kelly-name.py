# Runs inside LXC 129: catch any remaining "Joes'" with a CURLY apostrophe that
# the straight-apostrophe replace missed. Reports counts before/after.
import json
import urllib.request

KELLY = "de15dfc8-6bb8-494b-9efa-32e1ba943aa9"
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


a = req(f"/assistant/{KELLY}")
model = a["model"]
CURLY = "’"  # ’
for m in model.get("messages", []):
    if m.get("role") != "system":
        continue
    c = m["content"]
    # Count variants (exclude the one intentional mention in the header rule).
    print("before: straight Joes' =", c.count("Joes'"), " curly Joes’ =", c.count("Joes" + CURLY))
    c = c.replace("Joes" + CURLY, "Joe" + CURLY + "s")  # curly variant
    # Leave the single header instruction line intact; fix all other straight ones.
    m["content"] = c
    req(f"/assistant/{KELLY}", "PATCH", {"model": model})
    print("after:  straight Joes' =", c.count("Joes'"), " curly Joes’ =", c.count("Joes" + CURLY))
    # Show any lines still containing Joes (to eyeball the remaining one).
    for line in c.splitlines():
        if "Joes" in line:
            print("  still:", line.strip())
    break
