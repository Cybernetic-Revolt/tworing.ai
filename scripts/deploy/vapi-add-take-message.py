# Runs inside LXC 129: attach the take_message tool to James and Sarah,
# each authenticated with their own demo org's key. Idempotent.
import json
import urllib.request

TOOLS_URL = "https://tworing.ai/api/vapi/tools"
ASSISTANTS = {
    "534db2e3-da19-4bb5-b5ea-4cb4c09896c8": "/root/.tworing-key-james-plumbing",
    "cbeca395-1970-45f6-9b32-c2471eda4b43": "/root/.tworing-key-billys-realty",
}

with open("/etc/bilco-platform.env") as f:
    env = dict(
        line.strip().split("=", 1)
        for line in f
        if "=" in line and not line.startswith("#")
    )


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path,
        method=method,
        headers={
            "Authorization": f"Bearer {env['VAPI_API_KEY']}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.5.0",
        },
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


PROMPT_ADDITION = """

[Taking messages]
- Whenever you take a message — because no appointment time worked, the request needs the owner, or the caller just wants a callback — record it with the take_message tool. A message that isn't recorded with the tool does not exist.
- Collect before calling it: the caller's name, best callback number, and the message itself. Include the job or topic and address if given.
- After the tool confirms, tell the caller the team will call them back as soon as possible."""


def tool_def(secret):
    return {
        "type": "function",
        "async": False,
        "server": {"url": TOOLS_URL, "secret": secret},
        "function": {
            "name": "take_message",
            "description": "Record a message for the office. Use whenever the caller needs a callback or nothing could be booked — an unrecorded message does not exist.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Caller's name"},
                    "phone": {"type": "string", "description": "Best callback number"},
                    "message": {"type": "string", "description": "The message for the office, in the caller's words"},
                    "jobType": {"type": "string", "description": "Job or topic, if applicable"},
                    "address": {"type": "string", "description": "Address, if given"},
                    "urgency": {"type": "string", "description": "How urgent the caller says it is"},
                },
                "required": ["phone", "message"],
            },
        },
    }


for aid, keyfile in ASSISTANTS.items():
    with open(keyfile) as f:
        secret = f.read().strip()
    a = req(f"/assistant/{aid}")
    name = a.get("name", "?")
    model = a["model"]
    tools = model.get("tools", [])
    patch_needed = False

    if not any(t.get("function", {}).get("name") == "take_message" for t in tools):
        model["tools"] = tools + [tool_def(secret)]
        patch_needed = True

    for m in model.get("messages", []):
        if m.get("role") == "system" and "[Taking messages]" not in m.get("content", ""):
            m["content"] = m["content"] + PROMPT_ADDITION
            patch_needed = True
            break

    if not patch_needed:
        print(f"{name}: already wired")
        continue
    req(f"/assistant/{aid}", "PATCH", {"model": model})
    b = req(f"/assistant/{aid}")
    names = [t.get("function", {}).get("name") for t in b["model"].get("tools", [])]
    print(f"{name}: tools = {names}")
