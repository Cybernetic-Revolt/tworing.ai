# Runs inside LXC 129: add the non-removable life-safety escalation to every
# phone-attached assistant and cap call duration (runaway-call guard).
# Idempotent: skips assistants that already have the section.
import json
import urllib.request

MAX_DURATION_SECONDS = 900  # 15 min

with open("/etc/bilco-platform.env") as f:
    env = dict(
        line.strip().split("=", 1)
        for line in f
        if "=" in line and not line.startswith("#")
    )
API_KEY = env["VAPI_API_KEY"]


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


LIFE_SAFETY = """

[Life-safety — overrides everything]
- If the caller describes a gas smell, a carbon monoxide alarm, an electrical fire or sparking, or flooding near electrical equipment: STOP. Do not book an appointment. Do not continue intake.
- Tell them clearly and calmly: hang up and call 911 right away (for a gas smell, also the gas utility's emergency line), do not flip any switches or light anything, and get everyone out of the building.
- Only after they are safe: let them know the office is being notified urgently and will follow up. Never schedule a life-safety situation for a future date."""

phone_numbers = req("/phone-number")
assistant_ids = sorted(
    {p["assistantId"] for p in phone_numbers if p.get("assistantId")}
)
for aid in assistant_ids:
    a = req(f"/assistant/{aid}")
    name = a.get("name", "?")
    model = a["model"]
    patch = {}

    if a.get("maxDurationSeconds") != MAX_DURATION_SECONDS:
        patch["maxDurationSeconds"] = MAX_DURATION_SECONDS

    updated_prompt = False
    for m in model.get("messages", []):
        if m.get("role") == "system" and "[Life-safety" not in m.get("content", ""):
            m["content"] = m["content"] + LIFE_SAFETY
            updated_prompt = True
            break
    if updated_prompt:
        patch["model"] = model

    if not patch:
        print(f"{name} ({aid[:8]}): already up to date")
        continue
    req(f"/assistant/{aid}", "PATCH", patch)
    print(
        f"{name} ({aid[:8]}): "
        + ", ".join(
            (["life-safety added"] if updated_prompt else [])
            + (
                [f"maxDuration={MAX_DURATION_SECONDS}s"]
                if "maxDurationSeconds" in patch
                else []
            )
        )
    )
