# Runs inside LXC 127: repoint the Forward to Platform node at the LAN
# address — Cloudflare's WAF 403s large transcript payloads on the public URL.
import json
import sqlite3
import urllib.request

DB = "/var/lib/n8n/.n8n/database.sqlite"
WF_ID = "BEMkMltZPYfyNHkp"
LAN_URL = "http://10.10.1.129:3000/api/ingest/vapi"

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
node = next(n for n in wf["nodes"] if n["name"] == "Forward to Platform")
old = node["parameters"]["url"]
node["parameters"]["url"] = LAN_URL

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
print(f"url: {old} -> {LAN_URL}; active = {req(f'/workflows/{WF_ID}')['active']}")
