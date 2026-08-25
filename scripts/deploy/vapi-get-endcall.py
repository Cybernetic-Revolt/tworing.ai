# Runs inside LXC 129: show the call-ending-related config for Kelly.
import json
import urllib.request

KELLY = "de15dfc8-6bb8-494b-9efa-32e1ba943aa9"
with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]

r = urllib.request.Request(
    f"https://api.vapi.ai/assistant/{KELLY}",
    headers={"Authorization": f"Bearer {API_KEY}", "User-Agent": "curl/8.5.0"},
)
a = json.loads(urllib.request.urlopen(r).read())
for k in ["silenceTimeoutSeconds", "maxDurationSeconds", "endCallPhrases",
          "endCallFunctionEnabled", "startSpeakingPlan", "stopSpeakingPlan",
          "backgroundDenoisingEnabled"]:
    print(f"{k}: {json.dumps(a.get(k))}")
