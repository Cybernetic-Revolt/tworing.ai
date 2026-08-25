# Runs inside LXC 129: attach booking tools + prompt rules to the James
# assistant. Idempotent — skips if the tools are already attached.
import json
import urllib.request

ASSISTANT_ID = "534db2e3-da19-4bb5-b5ea-4cb4c09896c8"  # James Plumbing Inc
TOOLS_URL = "https://tworing.ai/api/vapi/tools"

with open("/etc/bilco-platform.env") as f:
    env = dict(
        line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#")
    )
API_KEY = env["VAPI_API_KEY"]
with open("/root/.bilco-ingest-key") as f:
    INGEST_KEY = f.read().strip()


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path,
        method=method,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.5.0",
        },
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


PROMPT_ADDITION = """

[Booking appointments]
- You can book real appointments. When a caller wants service scheduled, call the check_availability tool first (pass date as YYYY-MM-DD only if the caller asked about a specific day).
- Offer at most two of the returned slots, earliest first. Never invent or guess times — only offer slots the tool returned.
- Before booking, you must have: the caller's full name, callback number, service address, and the type of job.
- Book with book_appointment, passing the exact bracketed slotStart value of the slot the caller chose.
- For true emergencies (active flooding, no heat in freezing weather, gas smell), set emergency to true to book the soonest visit even outside normal hours.
- After booking, repeat the confirmed day and time back to the caller exactly as the tool stated it.
- If no offered time works, take a detailed message instead and assure the caller the office will call back to schedule."""

server = {"url": TOOLS_URL, "secret": INGEST_KEY}
tools = [
    {
        "type": "function",
        "async": False,
        "server": server,
        "function": {
            "name": "check_availability",
            "description": "Get the real open appointment slots for this business. Call this before offering any times to a caller.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Optional specific day to check, format YYYY-MM-DD. Omit to get the next available slots.",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "async": False,
        "server": server,
        "function": {
            "name": "book_appointment",
            "description": "Book an appointment in the business's real calendar. Only call after the caller has chosen a slot returned by check_availability and you have their name, phone, and address.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Caller's full name"},
                    "phone": {"type": "string", "description": "Best callback number"},
                    "address": {"type": "string", "description": "Service address"},
                    "jobType": {"type": "string", "description": "Short job description, e.g. 'Furnace - no heat'"},
                    "slotStart": {"type": "string", "description": "The exact bracketed slotStart value from check_availability"},
                    "notes": {"type": "string", "description": "Anything the technician should know"},
                    "emergency": {"type": "boolean", "description": "True only for genuine emergencies needing the soonest visit"},
                },
                "required": ["name", "phone", "slotStart"],
            },
        },
    },
]

a = req(f"/assistant/{ASSISTANT_ID}")
model = a["model"]
existing = [t.get("function", {}).get("name") for t in model.get("tools", [])]
if "check_availability" in existing:
    print("tools already attached; nothing to do")
    raise SystemExit(0)

model["tools"] = model.get("tools", []) + tools
for m in model.get("messages", []):
    if m.get("role") == "system" and "[Booking appointments]" not in m["content"]:
        m["content"] = m["content"] + PROMPT_ADDITION
        break

req(f"/assistant/{ASSISTANT_ID}", "PATCH", {"model": model})
b = req(f"/assistant/{ASSISTANT_ID}")
names = [t.get("function", {}).get("name") for t in b["model"].get("tools", [])]
has_prompt = any(
    "[Booking appointments]" in m.get("content", "")
    for m in b["model"].get("messages", [])
    if m.get("role") == "system"
)
print("tools now:", names)
print("prompt updated:", has_prompt)
print("server url:", b["model"]["tools"][0]["server"]["url"])
