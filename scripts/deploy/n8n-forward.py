# Runs inside LXC 127. Adds a "Forward to Platform" HTTP node to the live
# Vapi Webhook Handler, fed from the end-of-call branch, posting the original
# webhook body to the platform ingest endpoint. Idempotent.
import json
import sqlite3
import urllib.request
import uuid

KEY = open("/tmp/.bk").read().strip()
DB = "/var/lib/n8n/.n8n/database.sqlite"
WF_ID = "BEMkMltZPYfyNHkp"

con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
api_key = con.execute("SELECT apiKey FROM user_api_keys LIMIT 1").fetchone()[0]
con.close()

BASE = "http://localhost:5678/api/v1"


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        BASE + path,
        method=method,
        headers={"X-N8N-API-KEY": api_key, "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


wf = req(f"/workflows/{WF_ID}")
if any(n["name"] == "Forward to Platform" for n in wf["nodes"]):
    print("forward node already present")
    raise SystemExit(0)

email = next(n for n in wf["nodes"] if n["name"].startswith("Email"))
wf["nodes"].append(
    {
        "parameters": {
            "method": "POST",
            "url": "https://platform.bilco.ca/api/ingest/vapi",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [{"name": "x-bilco-ingest-key", "value": KEY}]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify($('Webhook').item.json.body) }}",
            "options": {},
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [email["position"][0], email["position"][1] + 220],
        "id": str(uuid.uuid4()),
        "name": "Forward to Platform",
        "onError": "continueRegularOutput",
    }
)

conns = wf["connections"]["Is End-Of-Call?"]["main"]
out_idx = next(
    i
    for i, outs in enumerate(conns)
    if outs and any(t["node"].startswith("Email") for t in outs)
)
conns[out_idx].append({"node": "Forward to Platform", "type": "main", "index": 0})

req(
    f"/workflows/{WF_ID}",
    "PUT",
    {
        "name": wf["name"],
        "nodes": wf["nodes"],
        "connections": wf["connections"],
        "settings": {"executionOrder": "v1"},
    },
)
wf2 = req(f"/workflows/{WF_ID}")
if not wf2["active"]:
    req(f"/workflows/{WF_ID}/activate", "POST", {})
    print("re-activated")
print("updated; active =", req(f"/workflows/{WF_ID}")["active"], "; nodes =", len(wf2["nodes"]))
