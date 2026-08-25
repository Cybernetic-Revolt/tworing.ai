# Runs inside LXC 129: configure each booking assistant's analysisPlan so Vapi
# generates a call summary + structured lead data on the end-of-call report.
# Without this, analysis.summary comes back empty and the portal shows "-".
# analysisPlan is a top-level assistant field, so this does NOT touch model/tools.
# Idempotent.
import json
import urllib.request

ASSISTANTS = [
    "534db2e3-da19-4bb5-b5ea-4cb4c09896c8",  # James
    "cbeca395-1970-45f6-9b32-c2471eda4b43",  # Sarah
    "de15dfc8-6bb8-494b-9efa-32e1ba943aa9",  # Kelly
]

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


ANALYSIS_PLAN = {
    "summaryPlan": {
        "enabled": True,
        "messages": [
            {"role": "system", "content": "You write concise call summaries for a home-services business owner reviewing their AI receptionist's calls. Plain, factual, no fluff."},
            {"role": "user", "content": "Summarize this call in 1-2 sentences: who called, what they wanted, and the outcome (booked, message taken, reschedule, just an inquiry, etc.).\n\nTranscript:\n{{transcript}}"},
        ],
    },
    "structuredDataPlan": {
        "enabled": True,
        "messages": [
            {"role": "system", "content": "Extract lead details from a phone call transcript. Only include a field if the caller clearly stated it; otherwise omit it."},
            {"role": "user", "content": "Transcript:\n{{transcript}}"},
        ],
        "schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Caller's name"},
                "phone": {"type": "string", "description": "Best callback number stated"},
                "email": {"type": "string"},
                "jobType": {"type": "string", "description": "Service/job they need"},
                "address": {"type": "string"},
                "urgency": {"type": "string", "description": "e.g. emergency, this week, flexible"},
                "notes": {"type": "string", "description": "Any other useful detail"},
            },
        },
    },
}

for aid in ASSISTANTS:
    a = req(f"/assistant/{aid}")
    name = a.get("name", "?")
    req(f"/assistant/{aid}", "PATCH", {"analysisPlan": ANALYSIS_PLAN})
    b = req(f"/assistant/{aid}")
    ap = b.get("analysisPlan", {})
    print(f"{name}: summaryPlan.enabled={ap.get('summaryPlan', {}).get('enabled')} "
          f"structuredDataPlan.enabled={ap.get('structuredDataPlan', {}).get('enabled')}")
