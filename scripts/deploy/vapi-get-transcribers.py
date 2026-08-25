# Runs inside LXC 129: show the transcriber (speech-to-text) config for each
# assistant, plus voice + model, so we can see why transcription is garbled.
import json
import urllib.request

ASSISTANTS = {
    "James": "534db2e3-da19-4bb5-b5ea-4cb4c09896c8",
    "Sarah": "cbeca395-1970-45f6-9b32-c2471eda4b43",
    "Kelly": "de15dfc8-6bb8-494b-9efa-32e1ba943aa9",
}
with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]


def req(path):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path,
        headers={"Authorization": f"Bearer {API_KEY}", "User-Agent": "curl/8.5.0"},
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


for name, aid in ASSISTANTS.items():
    a = req(f"/assistant/{aid}")
    t = a.get("transcriber") or {}
    print(f"== {name} ==")
    print("  transcriber:", json.dumps(t))
    print("  model:", a.get("model", {}).get("provider"), a.get("model", {}).get("model"))
