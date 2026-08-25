# Runs inside LXC 129: add find_appointments (lookup) tool to the three booking
# assistants + a prompt rule telling them to look up the caller's existing
# appointment (by the number they're calling from) before changing/cancelling.
# Idempotent.
import json
import urllib.request

ASSISTANTS = {
    "534db2e3-da19-4bb5-b5ea-4cb4c09896c8": "/root/.tworing-key-james-plumbing",
    "cbeca395-1970-45f6-9b32-c2471eda4b43": "/root/.tworing-key-billys-realty",
    "de15dfc8-6bb8-494b-9efa-32e1ba943aa9": "/root/.tworing-key-joes-lawn-snow",
}
TOOLS_URL = "https://tworing.ai/api/vapi/tools"
MARKER = "[Looking up an appointment]"

with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]

PROMPT = """

[Looking up an appointment]
- When a caller wants to change, reschedule, or cancel, call find_appointments FIRST to see what's on file. It defaults to the number they're calling from, so you usually don't need to ask for their number. Read the appointment back to confirm it's the right one before you move or cancel it.
- If find_appointments returns nothing, ask what number it was booked under and try find_appointments again with that number before doing anything else. Do not book a new appointment to "fix" a change request."""


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path, method=method,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


def find_tool(secret):
    return {"type": "function", "async": False, "server": {"url": TOOLS_URL, "secret": secret}, "function": {
        "name": "find_appointments",
        "description": "Look up the caller's upcoming appointments so you can confirm what they have before changing or cancelling. Uses the number they're calling from by default; pass phone only if they give a different one.",
        "parameters": {"type": "object", "properties": {
            "phone": {"type": "string", "description": "Optional: a number other than the one they're calling from"}}}}}


for aid, keyfile in ASSISTANTS.items():
    with open(keyfile) as f:
        secret = f.read().strip()
    a = req(f"/assistant/{aid}")
    name = a.get("name", "?")
    model = a["model"]
    tools = model.get("tools", [])
    have = {t.get("function", {}).get("name") for t in tools if t.get("type") == "function"}
    changed = False
    if "find_appointments" not in have:
        tools.append(find_tool(secret))
        model["tools"] = tools
        changed = True
    if MARKER not in json.dumps(model.get("messages", [])):
        for m in model.get("messages", []):
            if m.get("role") == "system":
                m["content"] = m["content"] + PROMPT
                changed = True
                break
    if not changed:
        print(f"{name}: already wired")
        continue
    req(f"/assistant/{aid}", "PATCH", {"model": model})
    b = req(f"/assistant/{aid}")
    names = [t.get("function", {}).get("name") or t.get("type") for t in b["model"].get("tools", [])]
    print(f"{name}: tools = {names}")
