# Runs inside LXC 127: the Forward to Platform node picks the ingest key by
# assistant — James, Sarah, and Kelly land in their own demo orgs; everything
# else (Ada, future) falls back to the bilco org key. Keys read from
# /tmp/.keys (4 lines: james, sarah, joes, bilco), which the caller deletes.
import json
import sqlite3
import urllib.request

JAMES_AID = "534db2e3-da19-4bb5-b5ea-4cb4c09896c8"
SARAH_AID = "cbeca395-1970-45f6-9b32-c2471eda4b43"
KELLY_AID = "de15dfc8-6bb8-494b-9efa-32e1ba943aa9"

with open("/tmp/.keys") as f:
    lines = [l.strip() for l in f.readlines()]
james_key, sarah_key, joes_key, bilco_key = lines[0], lines[1], lines[2], lines[3]

DB = "/var/lib/n8n/.n8n/database.sqlite"
WF_ID = "BEMkMltZPYfyNHkp"
con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
api_key = con.execute("SELECT apiKey FROM user_api_keys LIMIT 1").fetchone()[0]
con.close()
BASE = "http://localhost:5678/api/v1"


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        BASE + path, method=method,
        headers={"X-N8N-API-KEY": api_key, "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


expr = (
    "={{ ({"
    f'"{JAMES_AID}": "{james_key}", '
    f'"{SARAH_AID}": "{sarah_key}", '
    f'"{KELLY_AID}": "{joes_key}"'
    "})[$('Webhook').item.json.body.message.call.assistantId] "
    f'|| "{bilco_key}" }}}}'
)

wf = req(f"/workflows/{WF_ID}")
node = next(n for n in wf["nodes"] if n["name"] == "Forward to Platform")
node["parameters"]["headerParameters"]["parameters"][0]["value"] = expr
req(f"/workflows/{WF_ID}", "PUT", {
    "name": wf["name"], "nodes": wf["nodes"],
    "connections": wf["connections"], "settings": {"executionOrder": "v1"},
})
if not req(f"/workflows/{WF_ID}")["active"]:
    req(f"/workflows/{WF_ID}/activate", "POST", {})
print("routing updated (james/sarah/kelly + bilco fallback); active =", req(f"/workflows/{WF_ID}")["active"])
