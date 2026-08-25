# Runs inside LXC 127: disable the n8n "Email" node now that the platform
# sends owner notifications directly (avoids duplicate emails). Keeps the
# "Forward to Platform" node (still how the platform receives calls).
import json
import sqlite3
import urllib.request

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
changed = []
for n in wf["nodes"]:
    if n["name"].startswith("Email") and not n.get("disabled"):
        n["disabled"] = True
        changed.append(n["name"])

if not changed:
    print("no active Email node found (already disabled?)")
else:
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
    if not req(f"/workflows/{WF_ID}")["active"]:
        req(f"/workflows/{WF_ID}/activate", "POST", {})
    print("disabled:", changed, "| active =", req(f"/workflows/{WF_ID}")["active"])
