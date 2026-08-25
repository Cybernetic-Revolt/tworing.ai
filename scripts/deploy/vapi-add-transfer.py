# Runs inside LXC 129: add Vapi's native transferCall to James and Sarah,
# pointing at the human transfer number, with prompt rules. Idempotent.
import json
import urllib.request

TRANSFER_NUMBER = "+14036165487"  # human line (NOT the AI-forwarding business line)
ASSISTANTS = [
    "534db2e3-da19-4bb5-b5ea-4cb4c09896c8",  # James Plumbing Inc
    "cbeca395-1970-45f6-9b32-c2471eda4b43",  # Sarah / Billy's Realty
]

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


PROMPT = """

[Transferring to a person]
- If the caller explicitly asks to speak to a person, a human, the owner, or a manager — or raises something you genuinely cannot help with — use the transferCall tool to connect them.
- Do not offer a transfer proactively; only when the caller asks or clearly needs a human.
- Before transferring, let them know: "Sure, let me connect you — one moment.\""""

transfer_tool = {
    "type": "transferCall",
    "destinations": [
        {
            "type": "number",
            "number": TRANSFER_NUMBER,
            "message": "Alright, connecting you to the team now — one moment.",
        }
    ],
}

for aid in ASSISTANTS:
    a = req(f"/assistant/{aid}")
    name = a.get("name", "?")
    model = a["model"]
    tools = model.get("tools", [])
    patch_needed = False

    if not any(t.get("type") == "transferCall" for t in tools):
        model["tools"] = tools + [transfer_tool]
        patch_needed = True

    for m in model.get("messages", []):
        if m.get("role") == "system" and "[Transferring to a person]" not in m.get("content", ""):
            m["content"] = m["content"] + PROMPT
            patch_needed = True
            break

    if not patch_needed:
        print(f"{name}: already has transfer")
        continue
    req(f"/assistant/{aid}", "PATCH", {"model": model})
    b = req(f"/assistant/{aid}")
    types = [t.get("type") for t in b["model"].get("tools", [])]
    print(f"{name}: tool types = {types}")
