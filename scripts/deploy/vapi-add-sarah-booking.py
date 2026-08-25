# Runs inside LXC 129: give Sarah (Billy's Realty) the booking tools she was
# missing (check_availability + book_appointment) with the billys-realty key,
# so she can book showings consistently with James/Kelly. Idempotent.
import json
import urllib.request

SARAH = "cbeca395-1970-45f6-9b32-c2471eda4b43"
TOOLS_URL = "https://tworing.ai/api/vapi/tools"

with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]
with open("/root/.tworing-key-billys-realty") as f:
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
booking = [
    {"type": "function", "async": False, "server": server, "function": {
        "name": "check_availability",
        "description": "Get the real open showing/consult slots. Call before offering any times.",
        "parameters": {"type": "object", "properties": {"date": {"type": "string", "description": "Optional YYYY-MM-DD"}}}}},
    {"type": "function", "async": False, "server": server, "function": {
        "name": "book_appointment",
        "description": "Book a showing or consultation in the real calendar. Only after the caller picked a slot from check_availability and you have name, phone.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"}, "phone": {"type": "string"}, "address": {"type": "string"},
            "jobType": {"type": "string", "description": "e.g. 'Showing', 'Listing consult', 'Buyer consult'"},
            "slotStart": {"type": "string", "description": "exact bracketed slotStart from check_availability"},
            "notes": {"type": "string"}},
            "required": ["name", "phone", "slotStart"]}}},
]
PROMPT = """

[Booking showings]
- To schedule a showing or consultation, call check_availability first, offer at most two of the returned slots (earliest first), never invent times. Collect name and callback number, then book_appointment with the exact bracketed slotStart."""

a = req(f"/assistant/{SARAH}")
model = a["model"]
tools = model.get("tools", [])
have = {t.get("function", {}).get("name") for t in tools if t.get("type") == "function"}
added = []
for t in booking:
    if t["function"]["name"] not in have:
        tools.append(t)
        added.append(t["function"]["name"])
model["tools"] = tools
for m in model.get("messages", []):
    if m.get("role") == "system" and "[Booking showings]" not in m.get("content", ""):
        m["content"] = m["content"] + PROMPT
        break
req(f"/assistant/{SARAH}", "PATCH", {"model": model})
b = req(f"/assistant/{SARAH}")
print("Sarah tools:", [t.get("function", {}).get("name") or t.get("type") for t in b["model"].get("tools", [])])
print("added:", added)
