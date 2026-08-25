# Runs inside LXC 129: finish the Kelly assistant (Joes' Lawn & Snow) —
# attach all in-call tools with the joes-lawn-snow ingest key, add the
# booking/message/transfer/life-safety prompt sections, and cap call length.
# Idempotent.
import json
import urllib.request

KELLY = "de15dfc8-6bb8-494b-9efa-32e1ba943aa9"
TOOLS_URL = "https://tworing.ai/api/vapi/tools"
TRANSFER_NUMBER = "+14036165487"
MAX_DURATION = 900

with open("/etc/bilco-platform.env") as f:
    env = dict(
        line.strip().split("=", 1)
        for line in f if "=" in line and not line.startswith("#")
    )
API_KEY = env["VAPI_API_KEY"]
with open("/root/.tworing-key-joes-lawn-snow") as f:
    KEY = f.read().strip()


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path, method=method,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


server = {"url": TOOLS_URL, "secret": KEY}
fn_tools = [
    {"type": "function", "async": False, "server": server, "function": {
        "name": "check_availability",
        "description": "Get the real open appointment slots for this business. Call before offering any times.",
        "parameters": {"type": "object", "properties": {"date": {"type": "string", "description": "Optional YYYY-MM-DD"}}}}},
    {"type": "function", "async": False, "server": server, "function": {
        "name": "book_appointment",
        "description": "Book an appointment in the real calendar. Only after the caller picked a slot from check_availability and you have name, phone, address.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"}, "phone": {"type": "string"}, "address": {"type": "string"},
            "jobType": {"type": "string", "description": "e.g. 'Weekly mowing', 'Snow removal', 'Spring cleanup'"},
            "slotStart": {"type": "string", "description": "exact bracketed slotStart from check_availability"},
            "notes": {"type": "string"}, "emergency": {"type": "boolean"}},
            "required": ["name", "phone", "slotStart"]}}},
    {"type": "function", "async": False, "server": server, "function": {
        "name": "take_message",
        "description": "Record a message for the office when no time works or a callback is needed. An unrecorded message does not exist.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"}, "phone": {"type": "string"}, "message": {"type": "string"},
            "jobType": {"type": "string"}, "address": {"type": "string"}, "urgency": {"type": "string"}},
            "required": ["phone", "message"]}}},
    {"type": "transferCall", "destinations": [
        {"type": "number", "number": TRANSFER_NUMBER, "message": "Sure, let me connect you — one moment."}]},
]

PROMPT = """

[Booking, messages, transfers, safety]
- To schedule, call check_availability first (date YYYY-MM-DD only if the caller named a day); offer at most two of the returned slots, earliest first; never invent times. Before booking collect name, callback number, service address, and job type, then book_appointment with the exact bracketed slotStart. For urgent jobs (e.g. storm snow removal) set emergency true.
- If no time works or the caller wants a callback, record it with take_message.
- If the caller asks for a person/the owner, use the transfer tool.
- Safety: if a caller describes a gas leak, downed power line, or any life-threatening emergency, tell them to hang up and call 911 immediately; do not try to book it."""

a = req(f"/assistant/{KELLY}")
model = a["model"]
tools = model.get("tools", [])
have = {t.get("function", {}).get("name") for t in tools if t.get("type") == "function"}
have_transfer = any(t.get("type") == "transferCall" for t in tools)
new_tools = list(tools)
for t in fn_tools:
    if t["type"] == "function" and t["function"]["name"] not in have:
        new_tools.append(t)
    elif t["type"] == "transferCall" and not have_transfer:
        new_tools.append(t)
model["tools"] = new_tools

for m in model.get("messages", []):
    if m.get("role") == "system" and "[Booking, messages, transfers, safety]" not in m.get("content", ""):
        m["content"] = m["content"] + PROMPT
        break

req(f"/assistant/{KELLY}", "PATCH", {"model": model, "maxDurationSeconds": MAX_DURATION})
b = req(f"/assistant/{KELLY}")
names = [t.get("function", {}).get("name") or t.get("type") for t in b["model"].get("tools", [])]
print("Kelly tools:", names)
print("maxDuration:", b.get("maxDurationSeconds"))
