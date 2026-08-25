# Runs inside LXC 129: add reschedule_appointment + cancel_appointment tools
# (with each assistant's own org ingest key) and the prompt rule that tells
# the AI to MOVE an existing booking instead of creating a duplicate.
# Idempotent. Applies to the three booking assistants.
import json
import urllib.request

ASSISTANTS = {
    "534db2e3-da19-4bb5-b5ea-4cb4c09896c8": "/root/.tworing-key-james-plumbing",
    "cbeca395-1970-45f6-9b32-c2471eda4b43": "/root/.tworing-key-billys-realty",
    "de15dfc8-6bb8-494b-9efa-32e1ba943aa9": "/root/.tworing-key-joes-lawn-snow",
}
TOOLS_URL = "https://tworing.ai/api/vapi/tools"

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


PROMPT = """

[Changing or cancelling an appointment]
- If a caller wants to move, change, reschedule, or rebook an existing appointment, use reschedule_appointment — pass their phone number and the new slotStart from check_availability. NEVER use book_appointment to change an existing appointment; that leaves a duplicate. reschedule_appointment moves their booking to the new time and cancels the old one.
- If a caller wants to cancel outright, use cancel_appointment with their phone number.
- Always read the change back to confirm."""


def tools_for(secret):
    server = {"url": TOOLS_URL, "secret": secret}
    return [
        {"type": "function", "async": False, "server": server, "function": {
            "name": "reschedule_appointment",
            "description": "Move a caller's existing appointment to a new time. Use this (not book_appointment) whenever a caller wants to change/rebook. Cancels their old appointment and books the new slot.",
            "parameters": {"type": "object", "properties": {
                "phone": {"type": "string", "description": "The caller's number the appointment is under"},
                "slotStart": {"type": "string", "description": "exact bracketed slotStart from check_availability for the NEW time"},
                "name": {"type": "string"}, "jobType": {"type": "string"}, "address": {"type": "string"}, "notes": {"type": "string"}},
                "required": ["phone", "slotStart"]}}},
        {"type": "function", "async": False, "server": server, "function": {
            "name": "cancel_appointment",
            "description": "Cancel a caller's upcoming appointment.",
            "parameters": {"type": "object", "properties": {
                "phone": {"type": "string", "description": "The caller's number the appointment is under"}},
                "required": ["phone"]}}},
    ]


for aid, keyfile in ASSISTANTS.items():
    with open(keyfile) as f:
        secret = f.read().strip()
    a = req(f"/assistant/{aid}")
    name = a.get("name", "?")
    model = a["model"]
    tools = model.get("tools", [])
    have = {t.get("function", {}).get("name") for t in tools if t.get("type") == "function"}
    added = []
    for t in tools_for(secret):
        if t["function"]["name"] not in have:
            tools.append(t)
            added.append(t["function"]["name"])
    model["tools"] = tools
    for m in model.get("messages", []):
        if m.get("role") == "system" and "[Changing or cancelling an appointment]" not in m.get("content", ""):
            m["content"] = m["content"] + PROMPT
            break
    if not added and "[Changing or cancelling an appointment]" in json.dumps(model.get("messages", [])):
        print(f"{name}: already wired")
        continue
    req(f"/assistant/{aid}", "PATCH", {"model": model})
    b = req(f"/assistant/{aid}")
    names = [t.get("function", {}).get("name") or t.get("type") for t in b["model"].get("tools", [])]
    print(f"{name}: tools = {names}")
